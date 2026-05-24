-- Drop and recreate tables with correct schema
DROP TABLE IF EXISTS player_match_stats CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;
DROP TABLE IF EXISTS replay_uploads CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;

-- Create players table (correct schema)
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dota_rank text,
  avatar_url text,
  created_at timestamp DEFAULT now()
);

-- Create seasons table
CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT false,
  start_date date,
  end_date date,
  created_at timestamp DEFAULT now()
);

-- Create matches table (correct schema)
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES seasons(id),
  radiant_win boolean NOT NULL,
  match_date timestamptz DEFAULT now(),
  duration integer,
  created_at timestamp DEFAULT now()
);

-- Create player_match_stats table (correct schema)
CREATE TABLE player_match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  hero text,
  position integer,
  team text,
  kills integer DEFAULT 0,
  deaths integer DEFAULT 0,
  assists integer DEFAULT 0,
  last_hits integer DEFAULT 0,
  denies integer DEFAULT 0,
  gpm integer DEFAULT 0,
  xpm integer DEFAULT 0,
  hero_damage integer DEFAULT 0,
  tower_damage integer DEFAULT 0,
  hero_healing integer DEFAULT 0,
  performance_score numeric(5,2) DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Create uploads table
CREATE TABLE uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text,
  row_count integer DEFAULT 0,
  status text DEFAULT 'completed',
  error_message text,
  created_at timestamp DEFAULT now()
);

-- Create replay_uploads table
CREATE TABLE replay_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  match_id text,
  error_message text,
  uploaded_at timestamp DEFAULT now(),
  parsed_at timestamp,
  created_at timestamp DEFAULT now()
);

-- Disable RLS on replay_uploads
ALTER TABLE replay_uploads DISABLE ROW LEVEL SECURITY;

-- Enable RLS on other tables with public read
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read player_match_stats" ON player_match_stats FOR SELECT USING (true);
CREATE POLICY "Public read uploads" ON uploads FOR SELECT USING (true);

-- Grant permissions
GRANT ALL ON replay_uploads TO anon, authenticated, public;
GRANT SELECT ON seasons, players, matches, player_match_stats, uploads TO anon, authenticated;

-- Insert default season
INSERT INTO seasons (name, is_active, start_date)
VALUES ('Season 1', true, CURRENT_DATE);
