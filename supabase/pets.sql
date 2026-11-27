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
--  * Pet Tokens buy a pet (25 each, see pet_species.cost) and care items for it.
--  * A pet's stats (food, love, clean, rest) fall slowly over real time. They are
--    computed from the time of the last care action, so no scheduled job is needed.
--    Pets never die: a neglected pet is just sad until you look after it.
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
  kind text not null check (kind in ('dog', 'cat')),
  cost int not null default 25 check (cost >= 0),
  sort int not null default 0
);

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
  sort int not null default 0
);

-- ============================================
-- Per-owner state
-- ============================================
create table if not exists pet_wallets (
  owner_id uuid primary key references profiles(id) on delete cascade,
  tokens int not null default 0 check (tokens >= 0),
  lifetime_earned int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists pets (
  owner_id uuid primary key references profiles(id) on delete cascade,
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
  adopted_at timestamptz not null default now()
);

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
-- Catalog data (10 pets, 31 shop items)
-- ============================================
insert into pet_species (id, name, kind, cost, sort) values
  ('golden-retriever', 'Golden Retriever', 'dog', 25, 1),
  ('dalmatian',        'Dalmatian',        'dog', 25, 2),
  ('husky',            'Husky',            'dog', 25, 3),
  ('corgi',            'Corgi',            'dog', 25, 4),
  ('chocolate-lab',    'Chocolate Lab',    'dog', 25, 5),
  ('orange-tabby',     'Orange Tabby',     'cat', 25, 6),
  ('black-cat',        'Black Cat',        'cat', 25, 7),
  ('siamese',          'Siamese',          'cat', 25, 8),
  ('calico',           'Calico',           'cat', 25, 9),
  ('white-persian',    'White Persian',    'cat', 25, 10)
on conflict (id) do update
  set name = excluded.name, kind = excluded.kind, cost = excluded.cost, sort = excluded.sort;

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

-- Loads the caller's pet with its stats brought up to date for the time that has passed
-- (food -3/hour, love -2/hour, clean -1.5/hour, rest -2/hour; never below 0).
create or replace function public._pet_tick(p_owner uuid)
returns pets as $$
declare
  v_pet pets%rowtype;
  v_hours numeric;
begin
  select * into v_pet from pets where owner_id = p_owner for update;
  if not found then
    raise exception 'Adopt a pet first!';
  end if;
  v_hours := greatest(extract(epoch from (now() - v_pet.stats_at)) / 3600.0, 0);
  update pets
  set fullness = greatest(0, fullness - 3.0 * v_hours),
      love     = greatest(0, love     - 2.0 * v_hours),
      clean    = greatest(0, clean    - 1.5 * v_hours),
      rest     = greatest(0, rest     - 2.0 * v_hours),
      stats_at = now()
  where owner_id = p_owner
  returning * into v_pet;
  return v_pet;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public._pet_tick(uuid) from public, anon, authenticated;

-- ============================================
-- Reading state
-- ============================================
create or replace function public.pet_status()
returns jsonb as $$
declare
  v_owner uuid := public._pet_owner();
  v_wallet pet_wallets%rowtype;
  v_pet pets%rowtype;
  v_hours numeric := 0;
begin
  select * into v_wallet from pet_wallets where owner_id = v_owner;
  select * into v_pet from pets where owner_id = v_owner;
  if v_pet.owner_id is not null then
    v_hours := greatest(extract(epoch from (now() - v_pet.stats_at)) / 3600.0, 0);
  end if;

  return jsonb_build_object(
    'tokens', coalesce(v_wallet.tokens, 0),
    'lifetime', coalesce(v_wallet.lifetime_earned, 0),
    'pet', case when v_pet.owner_id is null then null else jsonb_build_object(
      'species_id', v_pet.species_id,
      'name', v_pet.name,
      'fullness', round(greatest(0, v_pet.fullness - 3.0 * v_hours), 1),
      'love',     round(greatest(0, v_pet.love     - 2.0 * v_hours), 1),
      'clean',    round(greatest(0, v_pet.clean    - 1.5 * v_hours), 1),
      'rest',     round(greatest(0, v_pet.rest     - 2.0 * v_hours), 1),
      'collar', v_pet.equipped_collar,
      'head', v_pet.equipped_head,
      'face', v_pet.equipped_face,
      'cuddle_ready_at', v_pet.last_cuddle_at + interval '30 minutes',
      'adopted_at', v_pet.adopted_at
    ) end,
    'inventory', coalesce(
      (select jsonb_object_agg(item_id, qty) from pet_inventory where owner_id = v_owner and qty > 0),
      '{}'::jsonb)
  );
end;
$$ language plpgsql security definer stable set search_path = public;

revoke execute on function public.pet_status() from public, anon;
grant execute on function public.pet_status() to authenticated;

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

create or replace function public.adopt_pet(p_species_id text, p_name text)
returns void as $$
declare
  v_owner uuid := public._pet_owner();
  v_species pet_species%rowtype;
  v_name text := public._pet_clean_name(p_name);
  v_tokens int;
begin
  select * into v_species from pet_species where id = p_species_id;
  if not found then
    raise exception 'That pet is not available';
  end if;
  if exists (select 1 from pets where owner_id = v_owner) then
    raise exception 'You already have a pet';
  end if;

  select tokens into v_tokens from pet_wallets where owner_id = v_owner for update;
  if v_tokens is null or v_tokens < v_species.cost then
    raise exception 'You need % Pet Tokens to adopt a pet', v_species.cost;
  end if;

  update pet_wallets set tokens = tokens - v_species.cost, updated_at = now()
  where owner_id = v_owner;

  insert into pets (owner_id, species_id, name) values (v_owner, v_species.id, v_name);

  -- Welcome pack so a new pet has a first meal and a snack
  insert into pet_inventory (owner_id, item_id, qty) values
    (v_owner, 'food-kibble', 2),
    (v_owner, 'treat-biscuit', 1)
  on conflict (owner_id, item_id) do update set qty = pet_inventory.qty + excluded.qty;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.adopt_pet(text, text) from public, anon;
grant execute on function public.adopt_pet(text, text) to authenticated;

create or replace function public.rename_pet(p_name text)
returns void as $$
declare
  v_owner uuid := public._pet_owner();
  v_name text := public._pet_clean_name(p_name);
begin
  update pets set name = v_name where owner_id = v_owner;
  if not found then
    raise exception 'Adopt a pet first!';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.rename_pet(text) from public, anon;
grant execute on function public.rename_pet(text) to authenticated;

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
-- Caring for the pet
-- ============================================
-- Feed, treat, bathe, play or put to bed with an item from the bag.
create or replace function public.use_pet_item(p_item_id text)
returns void as $$
declare
  v_owner uuid := public._pet_owner();
  v_item pet_items%rowtype;
  v_pet pets%rowtype;
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

  v_pet := public._pet_tick(v_owner);

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
  where owner_id = v_owner;

  -- Food, treats and grooming supplies get used up; toys and beds are kept
  if v_item.category in ('food', 'treat', 'groom') then
    update pet_inventory set qty = qty - 1 where owner_id = v_owner and item_id = v_item.id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.use_pet_item(text) from public, anon;
grant execute on function public.use_pet_item(text) to authenticated;

-- A free cuddle: a little love, once every 30 minutes
create or replace function public.pet_cuddle()
returns void as $$
declare
  v_owner uuid := public._pet_owner();
  v_pet pets%rowtype;
  v_wait int;
begin
  v_pet := public._pet_tick(v_owner);
  if v_pet.love >= 98 then
    raise exception '% is already full of love', v_pet.name;
  end if;
  if v_pet.last_cuddle_at is not null and v_pet.last_cuddle_at > now() - interval '30 minutes' then
    v_wait := ceil(extract(epoch from (v_pet.last_cuddle_at + interval '30 minutes' - now())) / 60.0);
    raise exception 'Cuddle again in % min', v_wait;
  end if;
  update pets set love = least(100, love + 8), last_cuddle_at = now() where owner_id = v_owner;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.pet_cuddle() from public, anon;
grant execute on function public.pet_cuddle() to authenticated;

-- ============================================
-- Dressing up
-- ============================================
create or replace function public.equip_pet_item(p_item_id text)
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

  update pets set
    equipped_collar = case when v_item.category = 'collar' then v_item.id else equipped_collar end,
    equipped_head   = case when v_item.category = 'head'   then v_item.id else equipped_head end,
    equipped_face   = case when v_item.category = 'face'   then v_item.id else equipped_face end
  where owner_id = v_owner;
  if not found then
    raise exception 'Adopt a pet first!';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.equip_pet_item(text) from public, anon;
grant execute on function public.equip_pet_item(text) to authenticated;

create or replace function public.unequip_pet_slot(p_slot text)
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
  where owner_id = v_owner;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.unequip_pet_slot(text) from public, anon;
grant execute on function public.unequip_pet_slot(text) to authenticated;

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
