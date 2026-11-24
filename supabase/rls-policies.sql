    -- Updated RLS policies that check profiles table instead of JWT claims
    -- Run this in Supabase SQL Editor to replace the existing policies

    -- Drop old policies
    drop policy if exists "Parents can view all profiles" on profiles;
    drop policy if exists "Children can view their own profile" on profiles;
    drop policy if exists "Parents can insert profiles" on profiles;
    drop policy if exists "Parents can update any profile" on profiles;
    drop policy if exists "Parents can manage chores" on chores;
    drop policy if exists "Children can read active chores" on chores;
    drop policy if exists "Parents can manage goals" on goals;
    drop policy if exists "Children can read their own goals" on goals;
    drop policy if exists "Parents can manage rewards" on rewards;
    drop policy if exists "Children can read available rewards" on rewards;
    drop policy if exists "Parents can view all transactions" on token_transactions;
    drop policy if exists "Children can view their own transactions" on token_transactions;
    drop policy if exists "Parents can insert transactions" on token_transactions;
    drop policy if exists "Parents can view all balances" on child_balances;
    drop policy if exists "Children can view their own balance" on child_balances;
    drop policy if exists "Parents can manage chore assignments" on chore_assignments;
    drop policy if exists "Children can read their assignments" on chore_assignments;
    drop policy if exists "Parents can manage completed tasks" on completed_tasks;
    drop policy if exists "Children can view their completed tasks" on completed_tasks;

    -- Table privileges: RLS only filters rows; the API roles still need base GRANTs,
    -- otherwise queries fail with "permission denied for table ...".
    grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to authenticated;

    -- Helper function to check if current user is a parent
    create or replace function is_parent()
    returns boolean as $$
      select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'parent'
      );
    $$ language sql security definer stable set search_path = public;

    -- Helper function to check if current user is a child
    create or replace function is_child()
    returns boolean as $$
      select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'child'
      );
    $$ language sql security definer stable set search_path = public;

    grant execute on function is_parent(), is_child() to authenticated;

    -- Profiles policies
    create policy "Parents can view all profiles" on profiles
      for select using (is_parent());

    create policy "Children can view their own profile" on profiles
      for select using (auth.uid() = id);

    create policy "Parents can insert profiles" on profiles
      for insert with check (is_parent());

    create policy "Parents can update any profile" on profiles
      for update using (is_parent());

    -- Chores policies
    create policy "Parents can manage chores" on chores
      for all using (is_parent());

    -- Children only see active chores that are assigned to them or up for grabs
    create policy "Children can read active chores" on chores
      for select using (
        is_child()
        and is_active = true
        and (assigned_to is null or assigned_to = auth.uid())
      );

    -- Goals policies
    create policy "Parents can manage goals" on goals
      for all using (is_parent());

    create policy "Children can read their own goals" on goals
      for select using (is_child() and child_id = auth.uid());

    -- Rewards policies
    create policy "Parents can manage rewards" on rewards
      for all using (is_parent());

    create policy "Children can read available rewards" on rewards
      for select using (is_available = true);

    -- Token transactions policies
    create policy "Parents can view all transactions" on token_transactions
      for select using (is_parent());

    create policy "Children can view their own transactions" on token_transactions
      for select using (is_child() and child_id = auth.uid());

    create policy "Parents can insert transactions" on token_transactions
      for insert with check (is_parent());

    -- Child balances policies
    create policy "Parents can view all balances" on child_balances
      for select using (is_parent());

    create policy "Children can view their own balance" on child_balances
      for select using (is_child() and child_id = auth.uid());

    -- Chore assignments policies
    create policy "Parents can manage chore assignments" on chore_assignments
      for all using (is_parent());

    create policy "Children can read their assignments" on chore_assignments
      for select using (is_child() and child_id = auth.uid());

    -- Completed tasks policies
    create policy "Parents can manage completed tasks" on completed_tasks
      for all using (is_parent());

    create policy "Children can view their completed tasks" on completed_tasks
      for select using (is_child() and child_id = auth.uid());

    -- Allow deleting a chore without wiping its completion history
    alter table completed_tasks drop constraint if exists completed_tasks_chore_id_fkey;
    alter table completed_tasks
      add constraint completed_tasks_chore_id_fkey
      foreign key (chore_id) references chores(id) on delete set null;

    -- ============================================
    -- Child chore completion
    -- ============================================

    -- Used by the app (null = up for grabs); no-op if it already exists
    alter table chores add column if not exists assigned_to uuid references profiles on delete set null;

    -- Create the balance row on first earn instead of silently updating nothing
    create or replace function public.update_child_balance()
    returns trigger as $$
    begin
      insert into public.child_balances (child_id, balance, updated_at)
      values (new.child_id, new.amount, now())
      on conflict (child_id) do update
        set balance = public.child_balances.balance + new.amount,
            updated_at = now();
      return new;
    end;
    $$ language plpgsql security definer set search_path = public;

    -- Shared logic for completing a chore on behalf of a child. Not callable from
    -- the API: it trusts p_child_id, so only the two wrappers below may use it.
    -- The reward comes from the chore itself, so nobody can award arbitrary tokens.
    create or replace function public._complete_chore(
      p_child_id uuid,
      p_chore_id uuid,
      p_by_parent boolean default false
    )
    returns void as $$
    declare
      v_chore chores%rowtype;
    begin
      -- Lock the chore row so rapid double-taps are processed one at a time
      select * into v_chore from chores
      where id = p_chore_id
        and is_active = true
        and (assigned_to is null or assigned_to = p_child_id)
      for update;

      if not found then
        raise exception 'Chore not available';
      end if;

      -- One-time chores: can only ever be completed once (by anyone)
      if v_chore.frequency = 'once' and exists (
        select 1 from completed_tasks where chore_id = v_chore.id
      ) then
        raise exception 'This chore has already been completed';
      end if;

      -- Daily chores: once per child per calendar day (family timezone)
      if v_chore.frequency = 'daily' and exists (
        select 1 from completed_tasks
        where child_id = p_child_id
          and chore_id = v_chore.id
          and completed_at >= date_trunc('day', now() at time zone 'America/New_York')
                              at time zone 'America/New_York'
      ) then
        raise exception 'Already completed today';
      end if;

      insert into completed_tasks (child_id, chore_id, tokens_earned)
      values (p_child_id, v_chore.id, v_chore.token_reward);

      insert into token_transactions (child_id, type, amount, reference_id, description)
      values (p_child_id, 'chore_completed', v_chore.token_reward, v_chore.id,
              'Completed: ' || v_chore.name
                || case when p_by_parent then ' (marked by parent)' else '' end);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public._complete_chore(uuid, uuid, boolean)
      from public, anon, authenticated;

    -- Children complete their own chores
    create or replace function public.complete_chore(p_chore_id uuid)
    returns void as $$
    begin
      if not is_child() then
        raise exception 'Only children can complete chores';
      end if;
      perform public._complete_chore(auth.uid(), p_chore_id, false);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.complete_chore(uuid) from public, anon;
    grant execute on function public.complete_chore(uuid) to authenticated;

    -- Parents complete a chore on a child's behalf
    create or replace function public.complete_chore_for_child(p_child_id uuid, p_chore_id uuid)
    returns void as $$
    begin
      if not is_parent() then
        raise exception 'Only parents can do this';
      end if;
      if not exists (select 1 from profiles where id = p_child_id and role = 'child') then
        raise exception 'Child not found';
      end if;
      perform public._complete_chore(p_child_id, p_chore_id, true);
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.complete_chore_for_child(uuid, uuid) from public, anon;
    grant execute on function public.complete_chore_for_child(uuid, uuid) to authenticated;

    -- Ids of one-time chores already completed by anyone (children can't read other
    -- children's completions directly, so this lets the app hide them).
    create or replace function public.completed_once_chore_ids()
    returns setof uuid as $$
      select distinct ct.chore_id
      from completed_tasks ct
      join chores c on c.id = ct.chore_id
      where c.frequency = 'once' and ct.chore_id is not null;
    $$ language sql security definer stable set search_path = public;

    revoke execute on function public.completed_once_chore_ids() from public, anon;
    grant execute on function public.completed_once_chore_ids() to authenticated;

    -- ============================================
    -- Parent balance override
    -- ============================================
    -- Sets a child's balance to an exact value by recording a manual_adjustment
    -- transaction for the difference, so the history stays consistent.
    create or replace function public.set_child_balance(
      p_child_id uuid,
      p_new_balance int,
      p_note text default null
    )
    returns void as $$
    declare
      v_current int;
    begin
      if not is_parent() then
        raise exception 'Only parents can adjust balances';
      end if;
      if p_new_balance < 0 then
        raise exception 'Balance cannot be negative';
      end if;
      if not exists (select 1 from profiles where id = p_child_id and role = 'child') then
        raise exception 'Child not found';
      end if;

      insert into child_balances (child_id, balance) values (p_child_id, 0)
      on conflict (child_id) do nothing;

      select balance into v_current from child_balances
      where child_id = p_child_id for update;

      if p_new_balance = v_current then
        return;
      end if;

      -- The on_token_transaction trigger applies the amount to child_balances
      insert into token_transactions (child_id, type, amount, description)
      values (
        p_child_id,
        'manual_adjustment',
        p_new_balance - v_current,
        'Balance set by parent' || coalesce(': ' || nullif(trim(p_note), ''), '')
      );
    end;
    $$ language plpgsql security definer set search_path = public;

    revoke execute on function public.set_child_balance(uuid, int, text) from public, anon;
    grant execute on function public.set_child_balance(uuid, int, text) to authenticated;
