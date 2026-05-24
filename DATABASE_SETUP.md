# Dota 2 Inhouse Stats - Database Setup

## Step 1: Run the SQL Setup Script

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to the SQL Editor (left sidebar)
4. Click "New Query"
5. Copy the contents of `/app/lib/supabase/setup.sql`
6. Paste it into the SQL editor
7. Click "Run" to execute the script

This will create:
- Tables: seasons, players, matches, player_match_stats, uploads
- Indexes for better performance
- Row Level Security policies (public read access)
- A default "Season 1"

## Step 2: Add Sample Data (Optional)

You can add sample data through the admin upload page or manually insert test data:

```sql
-- Insert sample players
INSERT INTO public.players (name, dota_rank) VALUES
  ('Player1', 'Divine 5'),
  ('Player2', 'Immortal'),
  ('Player3', 'Ancient 5'),
  ('Player4', 'Legend 3');

-- Insert sample matches (after you have a season_id)
-- Check your seasons table first: SELECT * FROM seasons;
```

## Step 3: Verify Setup

After running the SQL script, verify the tables were created:

1. Go to Table Editor in Supabase
2. You should see: seasons, players, matches, player_match_stats, uploads
3. Check that "Season 1" exists in the seasons table

## Next Steps

- Visit the admin page to upload CSV files with match data
- The leaderboard will automatically calculate stats from the uploaded data
- Use the CSV format shown in the admin upload page
