-- Add seasons table to existing database
-- Run this in your Supabase SQL Editor

-- Create seasons table
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key to matches table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'season_id'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_matches_season ON public.matches(season_id);

-- Enable Row Level Security
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DROP POLICY IF EXISTS "Public read seasons" ON public.seasons;
CREATE POLICY "Public read seasons" ON public.seasons FOR SELECT USING (true);

-- Grant public access
GRANT SELECT ON public.seasons TO anon, authenticated;

-- Insert default active season
INSERT INTO public.seasons (name, start_date, is_active)
VALUES ('Season 1', CURRENT_DATE, true)
ON CONFLICT DO NOTHING;

-- Update existing matches to use the default season if they don't have one
UPDATE public.matches 
SET season_id = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
WHERE season_id IS NULL;
