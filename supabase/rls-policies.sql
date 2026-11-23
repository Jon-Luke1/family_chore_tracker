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

-- Helper function to check if current user is a parent
create or replace function is_parent()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'parent'
  );
$$ language sql security definer;

-- Helper function to check if current user is a child
create or replace function is_child()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'child'
  );
$$ language sql security definer;

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

create policy "Children can read active chores" on chores
  for select using (is_child());

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
