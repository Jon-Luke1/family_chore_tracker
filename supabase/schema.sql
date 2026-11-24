-- Family Chore Tracker Database Schema
-- Copy and paste this into Supabase SQL Editor (Project Dashboard → SQL Editor)

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('parent', 'child')),
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. CHORES
-- ============================================
create table chores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  token_reward int not null default 10,
  frequency text default 'once' check (frequency in ('once', 'daily', 'weekly')),
  is_active boolean default true,
  assigned_to uuid, -- null = up for grabs; FK added after profiles exists
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 3. GOALS (longer-term objectives)
-- ============================================
create table goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  target_amount int not null,
  current_amount int default 0,
  child_id uuid references profiles on delete cascade not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 5. COMPLETED TASKS (log of chores/goals completed)
-- ============================================
create table completed_tasks (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid references chores,
  goal_id uuid references goals,
  child_id uuid references profiles on delete cascade not null,
  tokens_earned int not null,
  completed_at timestamptz default now(),
  verified_by uuid references profiles,
  notes text
);

-- ============================================
-- 6. CHORE ASSIGNMENTS (which child does which chore)
-- ============================================
create table chore_assignments (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid references chores on delete cascade not null,
  child_id uuid references profiles on delete cascade not null,
  assigned_by uuid references profiles not null,
  created_at timestamptz default now()
);

-- ============================================
-- 7. REWARDS (things to earn tokens for)
-- ============================================
create table rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  token_cost int not null,
  image_url text,
  is_available boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 7. TOKEN TRANSACTIONS (audit log)
-- ============================================
create table token_transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references profiles on delete cascade not null,
  type text not null check (type in ('chore_completed', 'goal_milestone', 'reward_claimed', 'manual_adjustment')),
  amount int not null,
  reference_id uuid, -- links to chore/transaction
  description text,
  created_at timestamptz default now()
);

-- ============================================
-- 8. CHILD TOKEN BALANCE (denormalized for fast reads)
-- ============================================
create table child_balances (
  child_id uuid references profiles on delete cascade primary key,
  balance int not null default 0,
  updated_at timestamptz default now()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table chores enable row level security;
alter table chore_assignments enable row level security;
alter table completed_tasks enable row level security;
alter table goals enable row level security;
alter table rewards enable row level security;
alter table token_transactions enable row level security;
alter table child_balances enable row level security;

-- Profiles: parents can see everything, children can see their own
create policy "Parents can view all profiles" on profiles
  for select using (auth.jwt() ->> 'role' = 'parent');

create policy "Children can view their own profile" on profiles
  for select using (auth.uid() = id);

create policy "Parents can insert profiles" on profiles
  for insert with check (auth.jwt() ->> 'role' = 'parent');

create policy "Parents can update any profile" on profiles
  for update using (auth.jwt() ->> 'role' = 'parent');

-- Chores: parents manage, children can read assigned ones
create policy "Parents can manage chores" on chores
  for all using (auth.jwt() ->> 'role' = 'parent');

create policy "Children can read active chores" on chores
  for select using (is_active = true);

-- Goals: parents manage, children can read their own
create policy "Parents can manage goals" on goals
  for all using (auth.jwt() ->> 'role' = 'parent');

create policy "Children can read their own goals" on goals
  for select using (child_id = auth.uid());

-- Rewards: parents manage, children can read available ones
create policy "Parents can manage rewards" on rewards
  for all using (auth.jwt() ->> 'role' = 'parent');

create policy "Children can read available rewards" on rewards
  for select using (is_available = true);

-- Token transactions: parents can see all, children can see their own
create policy "Parents can view all transactions" on token_transactions
  for select using (auth.jwt() ->> 'role' = 'parent');

create policy "Children can view their own transactions" on token_transactions
  for select using (child_id = auth.uid());

create policy "Parents can insert transactions" on token_transactions
  for insert with check (auth.jwt() ->> 'role' = 'parent');

-- Child balances: parents can see all, children can see their own
create policy "Parents can view all balances" on child_balances
  for select using (auth.jwt() ->> 'role' = 'parent');

create policy "Children can view their own balance" on child_balances
  for select using (child_id = auth.uid());

-- ============================================
-- Functions and triggers
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'child', new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update balance when transaction is added
create or replace function public.update_child_balance()
returns trigger as $$
begin
  update child_balances
  set balance = balance + new.amount,
      updated_at = now()
  where child_id = new.child_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_token_transaction
  after insert on token_transactions
  for each row execute function public.update_child_balance();
