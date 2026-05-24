-- Dota 2 Inhouse Statistics Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Seasons table
create table if not exists public.seasons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  start_date date not null,
  end_date date,
  is_active boolean default false,
  created_at timestamptz default now()
);

-- Players table
create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  dota_rank text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Matches table
create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid references public.seasons(id) on delete cascade,
  match_date timestamptz not null default now(),
  radiant_win boolean not null,
  duration integer,
  game_mode text,
  created_at timestamptz default now()
);

-- Player match stats table
create table if not exists public.player_match_stats (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  hero text not null,
  position integer,
  team text not null, -- 'radiant' or 'dire'
  kills integer default 0,
  deaths integer default 0,
  assists integer default 0,
  last_hits integer default 0,
  denies integer default 0,
  gpm integer default 0,
  xpm integer default 0,
  hero_damage integer default 0,
  tower_damage integer default 0,
  hero_healing integer default 0,
  performance_score numeric(5,2) default 0,
  created_at timestamptz default now()
);

-- Uploads tracking table
create table if not exists public.uploads (
  id uuid primary key default uuid_generate_v4(),
  file_name text not null,
  row_count integer default 0,
  status text default 'completed',
  error_message text,
  created_at timestamptz default now()
);

-- Create indexes for better query performance
create index if not exists idx_matches_season on public.matches(season_id);
create index if not exists idx_player_stats_match on public.player_match_stats(match_id);
create index if not exists idx_player_stats_player on public.player_match_stats(player_id);
create index if not exists idx_matches_date on public.matches(match_date);

-- Enable Row Level Security
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.uploads enable row level security;

-- Create policies for public read access
create policy "Public read seasons" on public.seasons for select using (true);
create policy "Public read players" on public.players for select using (true);
create policy "Public read matches" on public.matches for select using (true);
create policy "Public read player_match_stats" on public.player_match_stats for select using (true);
create policy "Public read uploads" on public.uploads for select using (true);

-- Grant public access
grant select on public.seasons to anon, authenticated;
grant select on public.players to anon, authenticated;
grant select on public.matches to anon, authenticated;
grant select on public.player_match_stats to anon, authenticated;
grant select on public.uploads to anon, authenticated;

-- Insert a default season
insert into public.seasons (name, start_date, is_active)
values ('Season 1', '2024-01-01', true)
on conflict do nothing;
