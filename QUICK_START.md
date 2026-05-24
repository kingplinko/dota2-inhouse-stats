# 🚀 Quick Start Guide

Get your Dota 2 Inhouse Stats Dashboard up and running in 3 simple steps!

## Step 1: Set Up the Database (5 minutes)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `oqgcxazzosqqmkujwcxj.supabase.co`

2. **Run the Setup SQL**
   - Click on **SQL Editor** in the left sidebar
   - Click **New Query**
   - Open the file `/app/lib/supabase/setup.sql` in this project
   - Copy ALL the content
   - Paste it into the SQL editor
   - Click the **Run** button (or press Ctrl/Cmd + Enter)

3. **Verify Success**
   - Go to **Table Editor** in the left sidebar
   - You should see these tables:
     - ✅ seasons
     - ✅ players
     - ✅ matches
     - ✅ player_match_stats
     - ✅ uploads
   - Click on the `seasons` table and verify "Season 1" exists

**✅ Database setup complete!**

---

## Step 2: Upload Sample Data (2 minutes)

You have two options:

### Option A: Use the Sample CSV (Easiest)

1. Visit the dashboard: https://inhouse-stats.preview.emergentagent.com/admin
2. Click **"Choose File"**
3. Select `/app/public/sample_matches.csv` from this project
   - Or download it from the admin page using the "Download Sample CSV" button
4. Click **"Upload"**
5. Wait for success message

### Option B: Create Your Own CSV

1. Create a CSV file with these columns:
```csv
player,hero,team,kills,deaths,assists,last_hits,denies,gpm,xpm,hero_damage,tower_damage,hero_healing,performance_score,position,dota_rank,match_date,win
```

2. Add your match data (see README.md for detailed format)
3. Upload via the admin page

**✅ Data uploaded!**

---

## Step 3: Explore the Dashboard (1 minute)

Visit: https://inhouse-stats.preview.emergentagent.com

### Pages to Explore:

1. **Leaderboard** (/)
   - View all players ranked by MMR
   - Search players, filter by season
   - See comprehensive stats

2. **Players** (/players)
   - Browse all players
   - Click any player to view their detailed profile

3. **Heroes** (/heroes)
   - See hero pick rates and win rates
   - Sort by various metrics

4. **Positions** (/positions)
   - Role-based statistics
   - Compare performance across positions

5. **Synergy** (/synergy)
   - Best hero combinations
   - Win rates for duos

6. **Matches** (/matches)
   - Full match history
   - Team compositions and results

7. **Seasons** (/seasons)
   - All seasons with stats
   - Active season indicator

8. **Admin** (/admin)
   - Upload more match data
   - View CSV format guide

**✅ You're all set!**

---

## Common Issues & Solutions

### Issue: "No players found"
**Solution:** Make sure you've uploaded the CSV data via the admin page.

### Issue: Tables not showing in Supabase
**Solution:** Re-run the setup SQL script. Make sure you copied the ENTIRE file.

### Issue: Upload fails
**Solution:** 
- Check your CSV format matches the example
- Ensure "Season 1" exists in the seasons table
- Verify all required columns are present

### Issue: Stats not calculating correctly
**Solution:** The stats calculate automatically from match data. Try refreshing the page.

---

## Next Steps

### Adding Real Match Data

1. Export your match data as CSV with the required columns
2. Go to `/admin` page
3. Upload your CSV file
4. Stats will update automatically

### Managing Seasons

1. Go to Supabase Dashboard → Table Editor → seasons
2. Insert new rows for new seasons
3. Set `is_active = true` for the current season
4. Set `is_active = false` for past seasons

### Customizing the Dashboard

- Colors and styling: Edit `/app/app/globals.css`
- Layout: Edit `/app/app/layout.js`
- Add more stat calculations: Edit page files in `/app/app/`

---

## Need Help?

1. Check the main README.md for detailed documentation
2. Check DATABASE_SETUP.md for database configuration help
3. Look at the console logs in your browser (F12)
4. Verify your Supabase credentials in `/app/.env`

---

## 🎉 Congratulations!

Your Dota 2 Inhouse Stats Dashboard is now live and ready to track your league's performance!

**Live URL:** https://inhouse-stats.preview.emergentagent.com

Share this with your players and start tracking stats! 🏆
