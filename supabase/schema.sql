-- Learnprint Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table (each analyzed GitHub repo)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  github_url text not null,
  owner text not null,
  repo text not null,
  tech_stack jsonb,
  created_at timestamptz default now()
);

-- Curricula table (Claude-generated learning paths)
create table if not exists curricula (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  data jsonb not null,       -- full Curriculum JSON
  total_xp int not null default 0,
  module_count int not null default 0,
  lesson_count int not null default 0,
  created_at timestamptz default now()
);

-- Progress table (which lessons a user completed)
create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  curriculum_id uuid references curricula(id) on delete cascade,
  lesson_id text not null,
  module_id text not null,
  xp_earned int not null default 0,
  completed_at timestamptz default now(),
  unique(user_id, curriculum_id, lesson_id)
);

-- User XP and streaks
create table if not exists user_xp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp int not null default 0,
  streak_days int not null default 0,
  longest_streak int not null default 0,
  last_activity_at timestamptz,
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_curricula_user_id on curricula(user_id);
create index if not exists idx_progress_user_curriculum on progress(user_id, curriculum_id);
create index if not exists idx_projects_user_id on projects(user_id);

-- RLS Policies
alter table projects enable row level security;
alter table curricula enable row level security;
alter table progress enable row level security;
alter table user_xp enable row level security;

-- Projects: users can only see their own
create policy "Users can view own projects"
  on projects for select using (auth.uid() = user_id);
create policy "Users can insert own projects"
  on projects for insert with check (auth.uid() = user_id);

-- Curricula: users can only see their own
create policy "Users can view own curricula"
  on curricula for select using (auth.uid() = user_id);
create policy "Users can insert own curricula"
  on curricula for insert with check (auth.uid() = user_id);

-- Progress: users can only see and update their own
create policy "Users can view own progress"
  on progress for select using (auth.uid() = user_id);
create policy "Users can insert own progress"
  on progress for insert with check (auth.uid() = user_id);

-- XP: users can read their own
create policy "Users can view own xp"
  on user_xp for select using (auth.uid() = user_id);
create policy "Users can upsert own xp"
  on user_xp for all using (auth.uid() = user_id);

-- Function to increment user XP
create or replace function increment_user_xp(p_user_id uuid, p_xp int)
returns void language plpgsql security definer as $$
begin
  insert into user_xp (user_id, total_xp, last_activity_at, updated_at)
  values (p_user_id, p_xp, now(), now())
  on conflict (user_id) do update
    set total_xp = user_xp.total_xp + p_xp,
        last_activity_at = now(),
        updated_at = now();
end;
$$;
