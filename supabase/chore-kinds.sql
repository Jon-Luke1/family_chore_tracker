-- Chore types: a chore can be a regular "chore", a "goal" or a "challenge".
-- It is only a label shown to parents and kids; everything else works the same.
-- Run this once in the Supabase SQL editor (safe to re-run). New installs get the
-- column from schema.sql already.

alter table chores add column if not exists kind text not null default 'chore';
alter table chores drop constraint if exists chores_kind_check;
alter table chores add constraint chores_kind_check check (kind in ('chore', 'goal', 'challenge'));
