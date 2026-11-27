    -- ============================================
    -- Pets & Pet Tokens
    -- ============================================
    -- Run this in the Supabase SQL editor AFTER schema.sql and rls-policies.sql.
    -- It is safe to re-run: tables use "if not exists" and the catalog (species and
    -- shop items) is upserted, so editing a price below and re-running updates it.
    --
    -- How it works
    --  * Whenever a child earns tokens (an approved chore, or a parent bonus) they also
    --    earn the same number of Pet Tokens.
    --  * Pet Tokens buy pets (25 each for dogs and cats, more for the exotic second tier; see
    --    pet_species.cost) and care items for them. Each person can have up to 5 pets.
    --  * Caring for a pet earns it XP, and keeping all four bars above 0 for a full day earns a
    --    big bonus. Pets level up to 30 and pay out bonus Pet Tokens for each new level.
    --  * A pet's stats (food, love, clean, rest) fall slowly over real time. They are
    --    computed from the time of the last care action, so no scheduled job is needed.
    --  * Pets can die. When two or more bars hit 0 the pet gets very sick. If that is not fixed
    --    within 2 days (fewer than two bars at 0 again) it dies. A dead pet can be revived for
    --    the price it was adopted for. See _pet_tick and revive_pet.
    --  * Opening the pet page ("checking in") pays 5 Pet Tokens, at most once an hour.
    --  * Seasonal items (pet_items.season) are only on sale during their season, e.g. Christmas
    --    from Nov 20 to Jan 6 (see _active_seasons). Items already bought stay usable all year.
    --  * Everything that changes pet state goes through the functions below; the app
    --    can only read these tables.
    --  * "Test mode" owners (e.g. Dad) are listed in pet_mirrors. Whenever the child they
    --    mirror earns Pet Tokens, they earn the same amount.

    -- ============================================
    -- Catalog
    -- ============================================
    create table if not exists pet_species (
      id text primary key,
      name text not null,
      kind text not null check (kind in ('dog', 'cat', 'bird', 'lizard', 'frog', 'turtle', 'hedgehog', 'axolotl')),
      tier int not null default 1,
      cost int not null default 25 check (cost >= 0),
      sort int not null default 0
    );

    -- Upgrading from the dogs-and-cats-only version
    alter table pet_species add column if not exists tier int not null default 1;
    alter table pet_species drop constraint if exists pet_species_kind_check;
    alter table pet_species add constraint pet_species_kind_check
      check (kind in ('dog', 'cat', 'bird', 'lizard', 'frog', 'turtle', 'hedgehog', 'axolotl'));

    -- category -> what it does:
    --   food / treat / groom  consumed on use (stack up to 20 in the bag)
    --   toy / bed             bought once, used any time
    --   collar / head / face  bought once, worn by the pet (one per slot)
    create table if not exists pet_items (
      id text primary key,
      name text not null,
      description text,
      category text not null check (category in ('food', 'treat', 'groom', 'toy', 'bed', 'collar', 'head', 'face')),
      tier int not null default 1 check (tier between 1 and 4),
      cost int not null check (cost >= 0),
      emoji text not null default '🎁',
      fullness int not null default 0,
      love int not null default 0,
      clean int not null default 0,
      rest int not null default 0,
      is_available boolean not null default true,
      sort int not null default 0,
      -- Food and treats are made for one tier of pet (1 = dogs and cats, 2 = exotic pets); null = any pet
      for_tier int
    );
    alter table pet_items add column if not exists for_tier int;
    -- Seasonal items are only for sale while their season is on (null = always available)
    alter table pet_items add column if not exists season text;

    -- ============================================
    -- Per-owner state
    -- ============================================
    create table if not exists pet_wallets (
      owner_id uuid primary key references profiles(id) on delete cascade,
      tokens int not null default 0 check (tokens >= 0),
      lifetime_earned int not null default 0,
      updated_at timestamptz not null default now()
    );

    alter table pet_wallets add column if not exists last_checkin_at timestamptz;

    create table if not exists pets (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references profiles(id) on delete cascade,
      species_id text not null references pet_species(id),
      name text not null,
      -- Stats are 0-100 as of stats_at; the current value is worked out from the elapsed time
      fullness numeric(6,2) not null default 100,
      love numeric(6,2) not null default 100,
      clean numeric(6,2) not null default 100,
      rest numeric(6,2) not null default 100,
      stats_at timestamptz not null default now(),
      equipped_collar text references pet_items(id) on delete set null,
      equipped_head text references pet_items(id) on delete set null,
      equipped_face text references pet_items(id) on delete set null,
      last_cuddle_at timestamptz,
      adopted_at timestamptz not null default now(),
      xp int not null default 0,
      level int not null default 1 check (level between 1 and 30),
      -- Since when every bar has stayed above 0 (null while one has run out)
      care_since timestamptz
    );

    -- Upgrading from the one-pet version (owner_id used to be the primary key)
    alter table pets add column if not exists id uuid default gen_random_uuid();
    update pets set id = gen_random_uuid() where id is null;
    alter table pets alter column id set not null;
    alter table pets add column if not exists xp int not null default 0;
    alter table pets add column if not exists level int not null default 1;
    alter table pets add column if not exists care_since timestamptz;
    -- Since when two or more bars have been at 0 (very sick); null while healthy
    alter table pets add column if not exists critical_since timestamptz;
    -- When the pet died (null while alive). A dead pet doesn't change until it is revived.
    alter table pets add column if not exists died_at timestamptz;
    do $$
    declare
      v_pk text;
    begin
      select conname into v_pk from pg_constraint
      where conrelid = 'public.pets'::regclass and contype = 'p'
        and pg_get_constraintdef(oid) = 'PRIMARY KEY (owner_id)';
      if v_pk is not null then
        execute format('alter table pets drop constraint %I', v_pk);
        alter table pets add constraint pets_pkey primary key (id);
      end if;
    end $$;
    create index if not exists pets_owner_idx on pets (owner_id);

    create table if not exists pet_inventory (
      owner_id uuid not null references profiles(id) on delete cascade,
      item_id text not null references pet_items(id) on delete cascade,
      qty int not null default 0 check (qty >= 0),
      primary key (owner_id, item_id)
    );

    -- Test mode: parent_id earns the same Pet Tokens as child_id
    create table if not exists pet_mirrors (
      parent_id uuid not null references profiles(id) on delete cascade,
      child_id uuid not null references profiles(id) on delete cascade,
      primary key (parent_id, child_id)
    );

    -- ============================================
    -- Row level security: read-only from the app
    -- ============================================
    alter table pet_species enable row level security;
    alter table pet_items enable row level security;
    alter table pet_wallets enable row level security;
    alter table pets enable row level security;
    alter table pet_inventory enable row level security;
    alter table pet_mirrors enable row level security;

    drop policy if exists "Anyone signed in can view pet species" on pet_species;
    drop policy if exists "Anyone signed in can view pet items" on pet_items;
    drop policy if exists "Owners and parents can view wallets" on pet_wallets;
    drop policy if exists "Owners and parents can view pets" on pets;
    drop policy if exists "Owners and parents can view inventory" on pet_inventory;
    drop policy if exists "Parents can view their own mirrors" on pet_mirrors;

    create policy "Anyone signed in can view pet species" on pet_species
      for select to authenticated using (true);
    create policy "Anyone signed in can view pet items" on pet_items
      for select to authenticated using (true);
    create policy "Owners and parents can view wallets" on pet_wallets
      for select using (owner_id = auth.uid() or is_parent());
    create policy "Owners and parents can view pets" on pets
      for select using (owner_id = auth.uid() or is_parent());
    create policy "Owners and parents can view inventory" on pet_inventory
      for select using (owner_id = auth.uid() or is_parent());
    create policy "Parents can view their own mirrors" on pet_mirrors
      for select using (parent_id = auth.uid());

    -- Default privileges hand out full access; take writes back (RLS would block them
    -- anyway, this makes it explicit). All changes go through the functions below.
    revoke insert, update, delete on pet_species, pet_items, pet_wallets, pets, pet_inventory, pet_mirrors
      from authenticated, anon;
    grant select on pet_species, pet_items, pet_wallets, pets, pet_inventory, pet_mirrors to authenticated;

    -- ============================================
    -- Catalog data (18 pets, 49 shop items)
    -- ============================================
    insert into pet_species (id, name, kind, tier, cost, sort) values
      ('golden-retriever', 'Golden Retriever', 'dog', 1, 25, 1),
      ('dalmatian',        'Dalmatian',        'dog', 1, 25, 2),
      ('husky',            'Husky',            'dog', 1, 25, 3),
      ('corgi',            'Corgi',            'dog', 1, 25, 4),
      ('chocolate-lab',    'Chocolate Lab',    'dog', 1, 25, 5),
      ('orange-tabby',     'Orange Tabby',     'cat', 1, 25, 6),
      ('black-cat',        'Black Cat',        'cat', 1, 25, 7),
      ('siamese',          'Siamese',          'cat', 1, 25, 8),
      ('calico',           'Calico',           'cat', 1, 25, 9),
      ('white-persian',    'White Persian',    'cat', 1, 25, 10),
      -- Second tier: exotic pets that cost more
      ('budgie',           'Budgie',           'bird',     2,  50, 11),
      ('leopard-gecko',    'Leopard Gecko',    'lizard',   2,  60, 12),
      ('tree-frog',        'Green Tree Frog',  'frog',     2,  60, 13),
      ('hedgehog',         'Hedgehog',         'hedgehog', 2,  70, 14),
      ('cockatiel',        'Cockatiel',        'bird',     2,  75, 15),
      ('red-eared-turtle', 'Red-Eared Turtle', 'turtle',   2,  80, 16),
      ('bearded-dragon',   'Bearded Dragon',   'lizard',   2,  90, 17),
      ('axolotl',          'Axolotl',          'axolotl',  2, 100, 18)
    on conflict (id) do update
      set name = excluded.name, kind = excluded.kind, tier = excluded.tier, cost = excluded.cost, sort = excluded.sort;

    insert into pet_items (id, name, description, category, tier, cost, emoji, fullness, love, clean, rest, sort) values
      -- Food: fills the tummy
      ('food-kibble',    'Crunchy Kibble',        'A scoop of good old kibble.',                 'food',  1,  2, '🥣',  20,  0,   0,   0, 101),
      ('food-chicken',   'Chicken & Rice',        'Warm, tasty and filling.',                    'food',  2,  5, '🍗',  40,  0,   0,   0, 102),
      ('food-salmon',    'Salmon Dinner',         'Fancy fish with a side of veggies.',          'food',  3, 10, '🐟',  70,  0,   0,   0, 103),
      ('food-feast',     'Royal Chef''s Feast',   'A five-star feast. Completely full tummy!',   'food',  4, 18, '🍖', 100, 10,   0,   0, 104),
      -- Treats: love (and a little snack)
      ('treat-biscuit',  'Tiny Biscuit',          'A crunchy little thank-you.',                 'treat', 1,  1, '🍪',   3,  8,   0,   0, 201),
      ('treat-bone',     'Chewy Bone',            'Great for gnawing on.',                       'treat', 2,  3, '🦴',   5, 15,   0,   0, 202),
      ('treat-cupcake',  'Pup-cake',              'A tiny frosted cupcake. So fancy!',           'treat', 3,  8, '🧁',  10, 30,   0,   0, 203),
      ('treat-cake',     'Rainbow Party Cake',    'A whole party in one treat.',                 'treat', 4, 15, '🎂',  15, 50,   0,   0, 204),
      -- Toys: play makes them happy (and a bit tired, hungry and messy). Bought once.
      ('toy-ball',       'Squeaky Ball',          'Squeak, squeak, squeak!',                     'toy',   1,  4, '🎾',   0, 12,   0,   0, 301),
      ('toy-wand',       'Feather Wand',          'Impossible to resist.',                       'toy',   2,  8, '🪶',   0, 20,   0,   0, 302),
      ('toy-tunnel',     'Tunnel & Tug Set',      'Zoom through the tunnel, then tug-of-war.',   'toy',   3, 14, '🧸',   0, 30,   0,   0, 303),
      ('toy-castle',     'Mega Play Castle',      'A castle with slides, tunnels and a flag.',   'toy',   4, 25, '🏰',   0, 45,   0,   0, 304),
      -- Grooming: gets them clean
      ('groom-wipes',    'Wet Wipes',             'A quick wipe-down.',                          'groom', 1,  2, '🧻',   0,  0,  20,   0, 401),
      ('groom-bath',     'Bubble Bath',           'Splish splash!',                              'groom', 2,  6, '🛁',   0,  0,  50,   0, 402),
      ('groom-spa',      'Spa Day',               'Shampoo, brush and a massage.',               'groom', 3, 12, '💆',   0, 10,  80,   0, 403),
      ('groom-deluxe',   'Luxury Groom & Blowout','Sparkling clean and fluffy as a cloud.',      'groom', 4, 20, '✨',   0, 20, 100,   0, 404),
      -- Beds: a nap restores rest. Bought once.
      ('bed-blanket',    'Cozy Blanket',          'Soft and snuggly.',                           'bed',   1,  5, '🧶',   0,  0,   0,  30, 501),
      ('bed-cushion',    'Soft Cushion Bed',      'A proper pet bed.',                           'bed',   2, 12, '🛏️',   0,  0,   0,  50, 502),
      ('bed-cloud',      'Plush Cloud Bed',       'Like sleeping on a cloud.',                   'bed',   3, 22, '☁️',   0,  0,   0,  75, 503),
      ('bed-royal',      'Royal Canopy Bed',      'Fit for a king or queen. Sweet dreams!',      'bed',   4, 40, '🏯',   0, 10,   0, 100, 504),
      -- Collars (worn)
      ('collar-red',     'Red Collar',            'Classic and cute.',                           'collar',1,  5, '🔴',   0,  0,   0,   0, 601),
      ('collar-bell',    'Jingle Bell Collar',    'Jingle, jingle!',                             'collar',2, 10, '🔔',   0,  0,   0,   0, 602),
      ('collar-rainbow', 'Rainbow Collar',        'All the colors.',                             'collar',3, 18, '🌈',   0,  0,   0,   0, 603),
      ('collar-diamond', 'Diamond Collar',        'Sparkles in the sun.',                        'collar',4, 35, '💎',   0,  0,   0,   0, 604),
      -- Hats & bows (worn)
      ('hat-bow',        'Pink Bow',              'Tied with love.',                             'head',  1,  8, '🎀',   0,  0,   0,   0, 701),
      ('hat-party',      'Party Hat',             'Every day is a party!',                       'head',  2, 12, '🎉',   0,  0,   0,   0, 702),
      ('hat-flowers',    'Flower Crown',          'Fresh spring flowers.',                       'head',  3, 20, '🌸',   0,  0,   0,   0, 703),
      ('hat-crown',      'Royal Crown',           'Rule the kingdom.',                           'head',  4, 40, '👑',   0,  0,   0,   0, 704),
      -- Glasses (worn)
      ('glasses-round',  'Round Specs',           'Smart and stylish.',                          'face',  1,  8, '👓',   0,  0,   0,   0, 801),
      ('glasses-cool',   'Cool Shades',           'Too cool for school.',                        'face',  2, 15, '🕶️',   0,  0,   0,   0, 802),
      ('glasses-heart',  'Heart Glasses',         'See the world with love.',                    'face',  3, 22, '💗',   0,  0,   0,   0, 803)
    on conflict (id) do update
      set name = excluded.name, description = excluded.description, category = excluded.category,
          tier = excluded.tier, cost = excluded.cost, emoji = excluded.emoji,
          fullness = excluded.fullness, love = excluded.love, clean = excluded.clean,
          rest = excluded.rest, sort = excluded.sort;

    -- Food and treats for dogs and cats (tier 1) ...
    update pet_items set for_tier = 1
    where id in ('food-kibble', 'food-chicken', 'food-salmon', 'food-feast',
                 'treat-biscuit', 'treat-bone', 'treat-cupcake', 'treat-cake');

    -- ... and for exotic pets (tier 2)
    insert into pet_items (id, name, description, category, tier, cost, emoji, fullness, love, clean, rest, sort, for_tier) values
      ('food-seeds',      'Seed Mix',              'A tasty scoop of seeds and grains.',          'food',  1,  2, '🌾',  20,  0,   0,   0, 111, 2),
      ('food-greens',     'Garden Salad',          'Fresh leafy greens.',                         'food',  2,  5, '🥗',  40,  0,   0,   0, 112, 2),
      ('food-mealworms',  'Mealworm Medley',       'Wriggly and delicious.',                      'food',  3, 10, '🐛',  70,  0,   0,   0, 113, 2),
      ('food-buffet',     'Gourmet Buffet',        'A little of everything. Completely full!',    'food',  4, 18, '🍱', 100, 10,   0,   0, 114, 2),
      ('treat-millet',    'Millet Spray',          'A crunchy little snack.',                     'treat', 1,  1, '🌿',   3,  8,   0,   0, 211, 2),
      ('treat-fruit',     'Fruit Bits',            'Sweet berries and melon.',                    'treat', 2,  3, '🍓',   5, 15,   0,   0, 212, 2),
      ('treat-cricket',   'Cricket Snack',         'A crunchy, crispy favorite.',                 'treat', 3,  8, '🦗',  10, 30,   0,   0, 213, 2),
      ('treat-honey',     'Golden Honey Drop',     'Sweet as can be.',                            'treat', 4, 15, '🍯',  15, 50,   0,   0, 214, 2)
    on conflict (id) do update
      set name = excluded.name, description = excluded.description, category = excluded.category,
          tier = excluded.tier, cost = excluded.cost, emoji = excluded.emoji,
          fullness = excluded.fullness, love = excluded.love, clean = excluded.clean,
          rest = excluded.rest, sort = excluded.sort, for_tier = excluded.for_tier;

    -- Seasonal: Christmas (on sale Nov 20 - Jan 6)
    insert into pet_items (id, name, description, category, tier, cost, emoji, fullness, love, clean, rest, sort, for_tier, season) values
      ('hat-santa',         'Santa Hat',             'Ho ho ho!',                                   'head',   2, 15, '🎅',   0,  0,   0,   0, 721, null, 'christmas'),
      ('hat-elf',           'Elf Hat',               'Straight from the workshop.',                 'head',   2, 15, '🧝',   0,  0,   0,   0, 722, null, 'christmas'),
      ('hat-antlers',       'Reindeer Antlers',      'Rudolph would be proud.',                     'head',   3, 18, '🦌',   0,  0,   0,   0, 723, null, 'christmas'),
      ('collar-candycane',  'Candy Cane Scarf',      'Striped, snug and sweet.',                    'collar', 2, 12, '🍭',   0,  0,   0,   0, 621, null, 'christmas'),
      ('collar-holly',      'Holly Collar',          'Holly leaves and shiny red berries.',         'collar', 3, 14, '🎄',   0,  0,   0,   0, 622, null, 'christmas'),
      ('glasses-snow',      'Snowflake Specs',       'Frosty and fabulous.',                        'face',   3, 16, '❄️',   0,  0,   0,   0, 821, null, 'christmas'),
      ('treat-gingerbread', 'Gingerbread Cookie',    'A freshly baked holiday cookie.',             'treat',  3,  6, '🍪',   8, 25,   0,   0, 221, 1,    'christmas'),
      ('treat-wintermix',   'Winter Berry Mix',      'Cranberries and a sprinkle of seeds.',        'treat',  3,  6, '🫐',   8, 25,   0,   0, 222, 2,    'christmas'),
      ('toy-snowball',      'Snowball',              'Fetch it before it melts!',                   'toy',    2,  8, '⛄',   0, 22,   0,   0, 321, null, 'christmas'),
      ('bed-sleigh',        'Santa''s Sleigh Bed',   'Sleep soundly on Christmas Eve.',             'bed',    3, 30, '🛷',   0, 10,   0,  70, 521, null, 'christmas')
    on conflict (id) do update
      set name = excluded.name, description = excluded.description, category = excluded.category,
          tier = excluded.tier, cost = excluded.cost, emoji = excluded.emoji,
          fullness = excluded.fullness, love = excluded.love, clean = excluded.clean,
          rest = excluded.rest, sort = excluded.sort, for_tier = excluded.for_tier, season = excluded.season;
    -- ============================================
    -- Earning Pet Tokens
    -- ============================================
    -- Adds Pet Tokens to a child's wallet, plus to every test-mode owner mirroring them.
    -- Internal: not callable from the API.
    create or replace function public._credit_pet_tokens(p_child_id uuid, p_amount int)
    returns void as $$
    begin
      if p_amount is null or p_amount <= 0 then
        return;
      end if;

      insert into pet_wallets (owner_id, tokens, lifetime_earned)
      values (p_child_id, p_amount, p_amount)
      on conflict (owner_id) do update
        set tokens = pet_wallets.tokens + excluded.tokens,
            lifetime_earned = pet_wallets.lifetime_earned + excluded.lifetime_earned,
            updated_at = now();

      insert into pet_wallets (owner_id, tokens, lifetime_earned)
      select m.parent_id, p_amount, p_amount from pet_mirrors m where m.child_id = p_child_id
      on conflict (owner_id) do update
        set tokens = pet_wallets.tokens + excluded.tokens,
            lifetime_earned = pet_wallets.lifetime_earned + excluded.lifetime_earned,
            updated_at = now();
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._credit_pet_tokens(uuid, int) from public, anon, authenticated;

    -- Approved chores (and goals) log a row in completed_tasks with the tokens earned
    create or replace function public._pet_tokens_from_completed_task()
    returns trigger as $$
    begin
      if exists (select 1 from profiles where id = new.child_id and role = 'child') then
        perform public._credit_pet_tokens(new.child_id, new.tokens_earned);
      end if;
      return new;
    end;
    $$ language plpgsql security definer set search_path = public;

    drop trigger if exists pet_tokens_on_completed_task on completed_tasks;
    create trigger pet_tokens_on_completed_task
      after insert on completed_tasks
      for each row execute function public._pet_tokens_from_completed_task();

    -- Parent bonuses count too
    create or replace function public._pet_tokens_from_bonus()
    returns trigger as $$
    begin
      perform public._credit_pet_tokens(new.child_id, new.amount);
      return new;
    end;
    $$ language plpgsql security definer set search_path = public;

    drop trigger if exists pet_tokens_on_bonus on bonus_awards;
    create trigger pet_tokens_on_bonus
      after insert on bonus_awards
      for each row execute function public._pet_tokens_from_bonus();

    -- ============================================
    -- Levels and XP
    -- ============================================
    -- A pet needs 50 + 15 x level XP to move from one level to the next. Max level is 30
    -- (7,975 XP in all). Care actions earn 6-12 XP, and every full day with all four bars
    -- above 0 earns 100 XP.
    create or replace function public._xp_total(p_level int)
    returns int as $$
      select 50 * (p_level - 1) + 15 * ((p_level - 1) * p_level / 2);
    $$ language sql immutable;

    create or replace function public._level_for_xp(p_xp int)
    returns int as $$
    declare
      v_level int := 1;
    begin
      while v_level < 30 and p_xp >= public._xp_total(v_level + 1) loop
        v_level := v_level + 1;
      end loop;
      return v_level;
    end;
    $$ language plpgsql immutable;

    -- Bonus Pet Tokens for reaching a level: 3 + level/2, and 5 extra every 5th level
    create or replace function public._level_reward(p_level int)
    returns int as $$
      select 3 + p_level / 2 + case when p_level % 5 = 0 then 5 else 0 end;
    $$ language sql immutable;

    revoke execute on function public._xp_total(int), public._level_for_xp(int), public._level_reward(int)
      from public, anon, authenticated;

    -- Pet Tokens that go straight to one wallet (no test-mode mirroring)
    create or replace function public._wallet_add(p_owner uuid, p_amount int)
    returns void as $$
    begin
      insert into pet_wallets (owner_id, tokens, lifetime_earned)
      values (p_owner, p_amount, p_amount)
      on conflict (owner_id) do update
        set tokens = pet_wallets.tokens + excluded.tokens,
            lifetime_earned = pet_wallets.lifetime_earned + excluded.lifetime_earned,
            updated_at = now();
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._wallet_add(uuid, int) from public, anon, authenticated;

    -- Adds XP to a pet and pays the Pet Token bonus for every level gained
    create or replace function public._pet_gain_xp(p_pet_id uuid, p_xp int)
    returns void as $$
    declare
      v_pet pets%rowtype;
      v_xp int;
      v_new int;
      v_lvl int;
    begin
      if p_xp is null or p_xp <= 0 then
        return;
      end if;
      select * into v_pet from pets where id = p_pet_id for update;
      v_xp := least(v_pet.xp + p_xp, public._xp_total(30));
      v_new := public._level_for_xp(v_xp);
      update pets set xp = v_xp, level = v_new where id = p_pet_id;
      for v_lvl in (v_pet.level + 1)..v_new loop
        perform public._wallet_add(v_pet.owner_id, public._level_reward(v_lvl));
      end loop;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._pet_gain_xp(uuid, int) from public, anon, authenticated;

    -- ============================================
    -- Who can own a pet: children, and parents that are set up for test mode
    -- ============================================
    create or replace function public._pet_owner()
    returns uuid as $$
    begin
      if is_child()
         or (is_parent() and exists (select 1 from pet_mirrors where parent_id = auth.uid())) then
        return auth.uid();
      end if;
      raise exception 'Pets are not available for this account';
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._pet_owner() from public, anon, authenticated;

    -- Retire the one-pet versions of the functions (the new ones take a pet id)
    drop function if exists public._pet_tick(uuid);
    drop function if exists public.adopt_pet(text, text);
    drop function if exists public.rename_pet(text);
    drop function if exists public.use_pet_item(text);
    drop function if exists public.pet_cuddle();
    drop function if exists public.equip_pet_item(text);
    drop function if exists public.unequip_pet_slot(text);
    drop function if exists public.pet_test_set_stats(numeric, numeric, numeric, numeric);

    -- Loads one of the caller's pets with its stats brought up to date for the time that has
    -- passed (food -3/hour, love -2/hour, clean -1.5/hour, rest -2/hour; never below 0).
    -- It also pays out the "all bars above 0" bonus: 100 XP for every full 24 hours.
    create or replace function public._pet_tick(p_pet_id uuid, p_owner uuid)
    returns pets as $$
    declare
      v_pet pets%rowtype;
      v_hours numeric;
      v_ok_hours numeric;
      v_end timestamptz;
      v_days int;
      v_care timestamptz;
      v_zero2 numeric;
      v_crit timestamptz;
      v_died timestamptz;
    begin
      select * into v_pet from pets where id = p_pet_id and owner_id = p_owner for update;
      if not found then
        raise exception 'Pet not found';
      end if;
      if v_pet.died_at is not null then
        return v_pet; -- nothing changes until the pet is revived
      end if;
      v_hours := greatest(extract(epoch from (now() - v_pet.stats_at)) / 3600.0, 0);
      v_care := v_pet.care_since;

      if v_care is not null then
        -- How long until the first bar drops below 1? The good streak lasts that long at most.
        v_ok_hours := least((v_pet.fullness - 1) / 3.0, (v_pet.love - 1) / 2.0,
                            (v_pet.clean - 1) / 1.5, (v_pet.rest - 1) / 2.0);
        v_end := v_pet.stats_at + make_interval(secs => 3600 * greatest(0, least(v_hours, v_ok_hours)));
        v_days := greatest(floor(extract(epoch from (v_end - v_care)) / 86400), 0)::int;
        if v_days > 0 then
          perform public._pet_gain_xp(v_pet.id, v_days * 100);
          v_care := v_care + make_interval(days => v_days);
        end if;
        if v_ok_hours < v_hours then
          v_care := null; -- a bar ran out, so the streak starts over
        end if;
      end if;

      -- Very sick: when did the second bar reach 0? (Bars fall in a straight line, so this is exact.)
      -- If it was not fixed within 2 days the pet dies, at that moment.
      v_crit := v_pet.critical_since;
      select z into v_zero2 from unnest(array[
        v_pet.fullness / 3.0, v_pet.love / 2.0, v_pet.clean / 1.5, v_pet.rest / 2.0]) z
        order by z offset 1 limit 1;
      if v_crit is not null and v_zero2 > 0 then
        v_crit := null; -- fewer than two bars were empty to begin with, so it can't be sick
      end if;
      if v_crit is null and v_zero2 <= v_hours then
        v_crit := v_pet.stats_at + make_interval(secs => 3600 * v_zero2);
      end if;
      if v_crit is not null and v_crit + interval '2 days' <= now() then
        v_died := v_crit + interval '2 days';
      end if;

      update pets
      set fullness = greatest(0, fullness - 3.0 * v_hours),
          love     = greatest(0, love     - 2.0 * v_hours),
          clean    = greatest(0, clean    - 1.5 * v_hours),
          rest     = greatest(0, rest     - 2.0 * v_hours),
          stats_at = now(),
          care_since = case when v_died is null then v_care else null end,
          critical_since = v_crit,
          died_at = v_died
      where id = v_pet.id
      returning * into v_pet;

      if v_pet.died_at is null and v_pet.care_since is null
         and least(v_pet.fullness, v_pet.love, v_pet.clean, v_pet.rest) >= 1 then
        update pets set care_since = now() where id = v_pet.id returning * into v_pet;
      end if;
      return v_pet;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._pet_tick(uuid, uuid) from public, anon, authenticated;

    -- After a care action: the good streak starts when every bar is above 0 and ends otherwise.
    -- The pet is very sick while two or more bars are at 0, and recovers as soon as that is no longer true.
    create or replace function public._pet_settle_streak(p_pet_id uuid)
    returns void as $$
    begin
      update pets
      set care_since = case when least(fullness, love, clean, rest) >= 1 then coalesce(care_since, now()) else null end,
          critical_since = case
            when (fullness <= 0)::int + (love <= 0)::int + (clean <= 0)::int + (rest <= 0)::int >= 2
              then coalesce(critical_since, now())
            else null end
      where id = p_pet_id;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._pet_settle_streak(uuid) from public, anon, authenticated;

    -- ============================================
    -- Reading state
    -- ============================================
    create or replace function public._pet_json(p pets)
    returns jsonb as $$
      select jsonb_build_object(
        'id', p.id,
        'species_id', p.species_id,
        'name', p.name,
        'fullness', round(p.fullness, 1),
        'love',     round(p.love, 1),
        'clean',    round(p.clean, 1),
        'rest',     round(p.rest, 1),
        'collar', p.equipped_collar,
        'head', p.equipped_head,
        'face', p.equipped_face,
        'cuddle_ready_at', p.last_cuddle_at + interval '30 minutes',
        'adopted_at', p.adopted_at,
        'level', p.level,
        'xp', p.xp,
        'xp_floor', public._xp_total(p.level),
        'xp_next', case when p.level >= 30 then null else public._xp_total(p.level + 1) end,
        'care_since', p.care_since,
        'critical_since', p.critical_since,
        'dies_at', p.critical_since + interval '2 days',
        'died_at', p.died_at,
        'revive_cost', (select cost from pet_species where id = p.species_id)
      );
    $$ language sql stable;

    revoke execute on function public._pet_json(pets) from public, anon, authenticated;

    -- Everything the app needs: tokens, all of the caller's pets (brought up to date) and the bag.
    -- Checking in also settles any "full day of good care" XP.
    create or replace function public.pet_status()
    returns jsonb as $$
    declare
      v_owner uuid := public._pet_owner();
      v_wallet pet_wallets%rowtype;
      v_pets jsonb := '[]'::jsonb;
      v_id uuid;
    begin
      for v_id in select id from pets where owner_id = v_owner order by adopted_at, id loop
        v_pets := v_pets || jsonb_build_array(public._pet_json(public._pet_tick(v_id, v_owner)));
      end loop;
      select * into v_wallet from pet_wallets where owner_id = v_owner;

      return jsonb_build_object(
        'tokens', coalesce(v_wallet.tokens, 0),
        'lifetime', coalesce(v_wallet.lifetime_earned, 0),
        'pets', v_pets,
        'max_pets', 5,
        'seasons', to_jsonb(public._active_seasons()),
        'checkin_bonus', 5,
        'checkin_ready_at', v_wallet.last_checkin_at + interval '1 hour',
        'inventory', coalesce(
          (select jsonb_object_agg(item_id, qty) from pet_inventory where owner_id = v_owner and qty > 0),
          '{}'::jsonb)
      );
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.pet_status() from public, anon;
    grant execute on function public.pet_status() to authenticated;

    -- ============================================
    -- Seasons and check-in bonus
    -- ============================================
    -- Which seasons are on right now (family timezone). Add a new season here, then give its
    -- items a matching pet_items.season.
    create or replace function public._active_seasons()
    returns text[] as $$
      select array_remove(array[
        case when (m = 11 and d >= 20) or m = 12 or (m = 1 and d <= 6) then 'christmas' end
      ]::text[], null)
      from (select extract(month from now() at time zone 'America/New_York')::int as m,
                   extract(day from now() at time zone 'America/New_York')::int as d) t;
    $$ language sql stable;

    revoke execute on function public._active_seasons() from public, anon, authenticated;

    -- Checking in on your pets pays 5 Pet Tokens, at most once an hour. The app calls this when
    -- the pet page opens. Returns how many tokens were paid (0 if it was too soon) and when the
    -- next bonus is ready.
    create or replace function public.pet_checkin()
    returns jsonb as $$
    declare
      v_owner uuid := public._pet_owner();
      v_last timestamptz;
      v_awarded int := 0;
    begin
      if not exists (select 1 from pets where owner_id = v_owner) then
        return jsonb_build_object('awarded', 0, 'ready_at', null);
      end if;

      perform public._wallet_add(v_owner, 0);
      select last_checkin_at into v_last from pet_wallets where owner_id = v_owner for update;

      if v_last is null or v_last <= now() - interval '1 hour' then
        perform public._wallet_add(v_owner, 5);
        update pet_wallets set last_checkin_at = now() where owner_id = v_owner;
        v_last := now();
        v_awarded := 5;
      end if;

      return jsonb_build_object('awarded', v_awarded, 'ready_at', v_last + interval '1 hour');
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.pet_checkin() from public, anon;
    grant execute on function public.pet_checkin() to authenticated;
    -- ============================================
    -- Adopting and naming
    -- ============================================
    create or replace function public._pet_clean_name(p_name text)
    returns text as $$
    declare
      v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
    begin
      if char_length(v_name) < 1 then
        raise exception 'Please give your pet a name';
      end if;
      if char_length(v_name) > 20 then
        raise exception 'That name is too long (20 letters at most)';
      end if;
      return v_name;
    end;
    $$ language plpgsql immutable;

    revoke execute on function public._pet_clean_name(text) from public, anon, authenticated;

    -- Adopts a pet (up to 5 per person) and returns its id
    create or replace function public.adopt_pet(p_species_id text, p_name text)
    returns uuid as $$
    declare
      v_owner uuid := public._pet_owner();
      v_species pet_species%rowtype;
      v_name text := public._pet_clean_name(p_name);
      v_tokens int;
      v_id uuid;
    begin
      select * into v_species from pet_species where id = p_species_id;
      if not found then
        raise exception 'That pet is not available';
      end if;

      -- Locking the wallet also keeps two adoptions at once from sneaking past the limit
      select tokens into v_tokens from pet_wallets where owner_id = v_owner for update;
      if v_tokens is null or v_tokens < v_species.cost then
        raise exception 'You need % Pet Tokens to adopt a % pet', v_species.cost, v_species.name;
      end if;
      if (select count(*) from pets where owner_id = v_owner) >= 5 then
        raise exception 'You can have up to 5 pets';
      end if;

      update pet_wallets set tokens = tokens - v_species.cost, updated_at = now()
      where owner_id = v_owner;

      insert into pets (owner_id, species_id, name, care_since)
      values (v_owner, v_species.id, v_name, now())
      returning id into v_id;

      -- Welcome pack so a new pet has a first meal and a snack
      insert into pet_inventory (owner_id, item_id, qty)
      select v_owner, x.item_id, x.qty
      from (values
        ('food-kibble', 2, 1), ('treat-biscuit', 1, 1),
        ('food-seeds', 2, 2), ('treat-millet', 1, 2)
      ) as x(item_id, qty, tier)
      where x.tier = v_species.tier
      on conflict (owner_id, item_id) do update set qty = least(20, pet_inventory.qty + excluded.qty);

      return v_id;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.adopt_pet(text, text) from public, anon;
    grant execute on function public.adopt_pet(text, text) to authenticated;

    create or replace function public.rename_pet(p_pet_id uuid, p_name text)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
      v_name text := public._pet_clean_name(p_name);
    begin
      update pets set name = v_name where id = p_pet_id and owner_id = v_owner;
      if not found then
        raise exception 'Pet not found';
      end if;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.rename_pet(uuid, text) from public, anon;
    grant execute on function public.rename_pet(uuid, text) to authenticated;

    -- ============================================
    -- Shopping
    -- ============================================
    create or replace function public.buy_pet_item(p_item_id text)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
      v_item pet_items%rowtype;
      v_tokens int;
      v_qty int;
      v_consumable boolean;
    begin
      select * into v_item from pet_items where id = p_item_id and is_available;
      if not found then
        raise exception 'That item is not for sale';
      end if;
      if v_item.season is not null and not (v_item.season = any (public._active_seasons())) then
        raise exception 'That item is out of season';
      end if;
      if not exists (select 1 from pets where owner_id = v_owner) then
        raise exception 'Adopt a pet first!';
      end if;

      v_consumable := v_item.category in ('food', 'treat', 'groom');
      select qty into v_qty from pet_inventory where owner_id = v_owner and item_id = v_item.id for update;
      v_qty := coalesce(v_qty, 0);
      if not v_consumable and v_qty > 0 then
        raise exception 'You already have this one';
      end if;
      if v_consumable and v_qty >= 20 then
        raise exception 'Your bag is full of these (20 max)';
      end if;

      select tokens into v_tokens from pet_wallets where owner_id = v_owner for update;
      if v_tokens is null or v_tokens < v_item.cost then
        raise exception 'Not enough Pet Tokens';
      end if;

      update pet_wallets set tokens = tokens - v_item.cost, updated_at = now()
      where owner_id = v_owner;

      insert into pet_inventory (owner_id, item_id, qty) values (v_owner, v_item.id, 1)
      on conflict (owner_id, item_id) do update set qty = pet_inventory.qty + 1;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.buy_pet_item(text) from public, anon;
    grant execute on function public.buy_pet_item(text) to authenticated;

    -- ============================================
    -- Caring for a pet
    -- ============================================
    -- Feed, treat, bathe, play or put to bed with an item from the bag. Earns XP.
    create or replace function public.use_pet_item(p_pet_id uuid, p_item_id text)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
      v_item pet_items%rowtype;
      v_pet pets%rowtype;
      v_tier int;
      v_qty int;
    begin
      select * into v_item from pet_items where id = p_item_id;
      if not found then
        raise exception 'Item not found';
      end if;
      if v_item.category in ('collar', 'head', 'face') then
        raise exception 'Use Wear for this one';
      end if;

      select qty into v_qty from pet_inventory
      where owner_id = v_owner and item_id = v_item.id for update;
      if coalesce(v_qty, 0) < 1 then
        raise exception 'You do not have that item';
      end if;

      v_pet := public._pet_tick(p_pet_id, v_owner);
      if v_pet.died_at is not null then
        raise exception '% has passed away. Revive them first.', v_pet.name;
      end if;
      select tier into v_tier from pet_species where id = v_pet.species_id;

      if v_item.for_tier is not null and v_item.for_tier <> v_tier then
        raise exception 'That is not the right kind of % for %', v_item.category, v_pet.name;
      end if;

      -- Don't waste an item on a pet that doesn't need it
      if v_item.category = 'food' and v_pet.fullness >= 95 then
        raise exception '% is not hungry right now', v_pet.name;
      elsif v_item.category in ('treat', 'toy') and v_pet.love >= 95 then
        raise exception '% could not be happier right now', v_pet.name;
      elsif v_item.category = 'groom' and v_pet.clean >= 95 then
        raise exception '% is already sparkling clean', v_pet.name;
      elsif v_item.category = 'bed' and v_pet.rest >= 90 then
        raise exception '% is not sleepy right now', v_pet.name;
      end if;

      update pets set
        fullness = least(100, greatest(0, fullness + v_item.fullness - (case when v_item.category = 'toy' then 4 else 0 end))),
        love     = least(100, greatest(0, love + v_item.love)),
        clean    = least(100, greatest(0, clean + v_item.clean - (case when v_item.category = 'toy' then 3 else 0 end))),
        rest     = least(100, greatest(0, rest + v_item.rest - (case when v_item.category = 'toy' then 4 else 0 end)))
      where id = p_pet_id;

      -- Food, treats and grooming supplies get used up; toys and beds are kept
      if v_item.category in ('food', 'treat', 'groom') then
        update pet_inventory set qty = qty - 1 where owner_id = v_owner and item_id = v_item.id;
      end if;

      perform public._pet_gain_xp(p_pet_id, case v_item.category
        when 'toy' then 12 when 'treat' then 8 else 10 end);
      perform public._pet_settle_streak(p_pet_id);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.use_pet_item(uuid, text) from public, anon;
    grant execute on function public.use_pet_item(uuid, text) to authenticated;

    -- A free cuddle: a little love (and 6 XP), once every 30 minutes per pet
    create or replace function public.pet_cuddle(p_pet_id uuid)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
      v_pet pets%rowtype;
      v_wait int;
    begin
      v_pet := public._pet_tick(p_pet_id, v_owner);
      if v_pet.died_at is not null then
        raise exception '% has passed away. Revive them first.', v_pet.name;
      end if;
      if v_pet.love >= 98 then
        raise exception '% is already full of love', v_pet.name;
      end if;
      if v_pet.last_cuddle_at is not null and v_pet.last_cuddle_at > now() - interval '30 minutes' then
        v_wait := ceil(extract(epoch from (v_pet.last_cuddle_at + interval '30 minutes' - now())) / 60.0);
        raise exception 'Cuddle again in % min', v_wait;
      end if;
      update pets set love = least(100, love + 8), last_cuddle_at = now() where id = p_pet_id;
      perform public._pet_gain_xp(p_pet_id, 6);
      perform public._pet_settle_streak(p_pet_id);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.pet_cuddle(uuid) from public, anon;
    grant execute on function public.pet_cuddle(uuid) to authenticated;

    -- ============================================
    -- Dressing up
    -- ============================================
    -- The bag holds one of each wearable. If another of your pets is wearing it, it moves over.
    create or replace function public.equip_pet_item(p_pet_id uuid, p_item_id text)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
      v_item pet_items%rowtype;
    begin
      select * into v_item from pet_items where id = p_item_id;
      if not found or v_item.category not in ('collar', 'head', 'face') then
        raise exception 'That can not be worn';
      end if;
      if not exists (select 1 from pet_inventory where owner_id = v_owner and item_id = v_item.id and qty > 0) then
        raise exception 'You do not have that item';
      end if;
      perform 1 from pets where id = p_pet_id and owner_id = v_owner for update;
      if not found then
        raise exception 'Pet not found';
      end if;

      update pets set
        equipped_collar = case when equipped_collar = v_item.id then null else equipped_collar end,
        equipped_head   = case when equipped_head   = v_item.id then null else equipped_head end,
        equipped_face   = case when equipped_face   = v_item.id then null else equipped_face end
      where owner_id = v_owner and id <> p_pet_id;

      update pets set
        equipped_collar = case when v_item.category = 'collar' then v_item.id else equipped_collar end,
        equipped_head   = case when v_item.category = 'head'   then v_item.id else equipped_head end,
        equipped_face   = case when v_item.category = 'face'   then v_item.id else equipped_face end
      where id = p_pet_id;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.equip_pet_item(uuid, text) from public, anon;
    grant execute on function public.equip_pet_item(uuid, text) to authenticated;

    create or replace function public.unequip_pet_slot(p_pet_id uuid, p_slot text)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
    begin
      if p_slot not in ('collar', 'head', 'face') then
        raise exception 'Unknown slot';
      end if;
      update pets set
        equipped_collar = case when p_slot = 'collar' then null else equipped_collar end,
        equipped_head   = case when p_slot = 'head'   then null else equipped_head end,
        equipped_face   = case when p_slot = 'face'   then null else equipped_face end
      where id = p_pet_id and owner_id = v_owner;
      if not found then
        raise exception 'Pet not found';
      end if;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.unequip_pet_slot(uuid, text) from public, anon;
    grant execute on function public.unequip_pet_slot(uuid, text) to authenticated;

    -- ============================================
    -- Reviving
    -- ============================================
    -- Brings a dead pet back (name, level and clothes are kept) for the price it was adopted for.
    -- It comes back at 50% on every bar and its good-care streak starts over.
    create or replace function public.revive_pet(p_pet_id uuid)
    returns void as $$
    declare
      v_owner uuid := public._pet_owner();
      v_pet pets%rowtype;
      v_cost int;
      v_tokens int;
    begin
      v_pet := public._pet_tick(p_pet_id, v_owner);
      if v_pet.died_at is null then
        raise exception '% does not need reviving', v_pet.name;
      end if;
      select cost into v_cost from pet_species where id = v_pet.species_id;

      select tokens into v_tokens from pet_wallets where owner_id = v_owner for update;
      if v_tokens is null or v_tokens < v_cost then
        raise exception 'Reviving % costs % Pet Tokens', v_pet.name, v_cost;
      end if;

      update pet_wallets set tokens = tokens - v_cost, updated_at = now() where owner_id = v_owner;
      update pets
      set fullness = 50, love = 50, clean = 50, rest = 50, stats_at = now(),
          died_at = null, critical_since = null, care_since = now(), last_cuddle_at = null
      where id = p_pet_id;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.revive_pet(uuid) from public, anon;
    grant execute on function public.revive_pet(uuid) to authenticated;
    -- ============================================
    -- Parents award Pet Tokens directly
    -- ============================================
    -- Gives Pet Tokens only (no regular tokens). Test-mode mirrors are credited too.
    create or replace function public.award_pet_tokens(p_child_id uuid, p_amount int)
    returns void as $$
    begin
      if not is_parent() then
        raise exception 'Only parents can award Pet Tokens';
      end if;
      if p_amount is null or p_amount < 1 or p_amount > 1000 then
        raise exception 'Enter between 1 and 1000 Pet Tokens';
      end if;
      if not exists (select 1 from profiles where id = p_child_id and role = 'child') then
        raise exception 'Child not found';
      end if;
      perform public._credit_pet_tokens(p_child_id, p_amount);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.award_pet_tokens(uuid, int) from public, anon;
    grant execute on function public.award_pet_tokens(uuid, int) to authenticated;

    -- ============================================
    -- Test mode: set a pet's stats and level by hand
    -- ============================================
    -- Only for parents that are set up for test mode (listed in pet_mirrors), and only on
    -- their own pets. Lets you drag the sliders to see how a pet reacts.
    create or replace function public.pet_test_set_stats(
      p_pet_id uuid, p_fullness numeric, p_love numeric, p_clean numeric, p_rest numeric
    )
    returns void as $$
    begin
      if not is_parent() or not exists (select 1 from pet_mirrors where parent_id = auth.uid()) then
        raise exception 'Pet test mode is not enabled for you';
      end if;
      update pets
      set fullness = least(100, greatest(0, coalesce(p_fullness, fullness))),
          love     = least(100, greatest(0, coalesce(p_love, love))),
          clean    = least(100, greatest(0, coalesce(p_clean, clean))),
          rest     = least(100, greatest(0, coalesce(p_rest, rest))),
          stats_at = now(),
          died_at = null -- moving a slider also brings a dead test pet back
      where id = p_pet_id and owner_id = auth.uid();
      if not found then
        raise exception 'Pet not found';
      end if;
      perform public._pet_settle_streak(p_pet_id);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.pet_test_set_stats(uuid, numeric, numeric, numeric, numeric) from public, anon;
    grant execute on function public.pet_test_set_stats(uuid, numeric, numeric, numeric, numeric) to authenticated;

    -- Test mode: make a pet very sick (food and love at 0) as if it had been that way for p_hours.
    -- 47 hours is right before it dies, 48 or more kills it (the next time it is loaded).
    create or replace function public.pet_test_set_critical(p_pet_id uuid, p_hours numeric)
    returns void as $$
    begin
      if not is_parent() or not exists (select 1 from pet_mirrors where parent_id = auth.uid()) then
        raise exception 'Pet test mode is not enabled for you';
      end if;
      if p_hours is null or p_hours < 0 or p_hours > 500 then
        raise exception 'Hours must be between 0 and 500';
      end if;
      update pets
      set fullness = 0, love = 0, stats_at = now(), died_at = null, care_since = null,
          critical_since = now() - make_interval(secs => 3600 * p_hours)
      where id = p_pet_id and owner_id = auth.uid();
      if not found then
        raise exception 'Pet not found';
      end if;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.pet_test_set_critical(uuid, numeric) from public, anon;
    grant execute on function public.pet_test_set_critical(uuid, numeric) to authenticated;
    -- Jump a pet to any level (1-30) to see how it looks. No bonus tokens are paid.
    create or replace function public.pet_test_set_level(p_pet_id uuid, p_level int)
    returns void as $$
    begin
      if not is_parent() or not exists (select 1 from pet_mirrors where parent_id = auth.uid()) then
        raise exception 'Pet test mode is not enabled for you';
      end if;
      if p_level is null or p_level < 1 or p_level > 30 then
        raise exception 'Level must be between 1 and 30';
      end if;
      update pets set level = p_level, xp = public._xp_total(p_level)
      where id = p_pet_id and owner_id = auth.uid();
      if not found then
        raise exception 'Pet not found';
      end if;
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.pet_test_set_level(uuid, int) from public, anon;
    grant execute on function public.pet_test_set_level(uuid, int) to authenticated;

    -- ============================================
    -- Parent test mode: "Dad" mirrors Emerson
    -- ============================================
    -- Matches on display names (case-insensitive). Check it worked with:
    --   select p.display_name as parent, c.display_name as child
    --   from pet_mirrors m join profiles p on p.id = m.parent_id join profiles c on c.id = m.child_id;
    -- To add another test owner, copy this with different names.
    insert into pet_mirrors (parent_id, child_id)
    select p.id, c.id
    from profiles p, profiles c
    where p.role = 'parent' and lower(p.display_name) = 'dad'
      and c.role = 'child' and lower(c.display_name) = 'emerson'
    on conflict do nothing;

    -- Optional, one time: give each child Pet Tokens equal to the tokens they have already
    -- earned from chores. Leave commented out to start everyone at zero.
    -- insert into pet_wallets (owner_id, tokens, lifetime_earned)
    -- select child_id, sum(tokens_earned), sum(tokens_earned) from completed_tasks group by child_id
    -- on conflict (owner_id) do nothing;
