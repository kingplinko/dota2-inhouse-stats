# 🎮 Dota 2 Replay (.dem) Parser - Feature Complete!

## Overview

Your dashboard now supports **native Dota 2 replay file parsing**! Upload `.dem` files directly and all match data will be automatically extracted and added to your leaderboard.

## ✨ What's New

### Replay Upload Tab
- Navigate to **Admin → Replay (.dem)** tab
- Upload `.dem` replay files (50-200MB typical size)
- Automatic parsing and data extraction (30-60 seconds)
- No manual data entry needed!

### Automatic Data Extraction

The parser automatically extracts:
- ✅ **Match Info**: Duration, winner (Radiant/Dire), game mode
- ✅ **Player Stats**: Kills, deaths, assists
- ✅ **Farm Stats**: GPM, XPM, last hits, denies
- ✅ **Damage**: Hero damage, tower damage, healing
- ✅ **Team**: Radiant or Dire assignment
- ✅ **Heroes**: Hero picks for each player
- ✅ **Performance Score**: Auto-calculated from KDA + farm

### Smart Database Integration
- Creates players automatically if they don't exist
- Inserts match data into your Supabase database
- Links to active season
- Prevents duplicate uploads (coming soon)
- Updates leaderboard in real-time

## 📁 Where to Find Replay Files

### Windows
```
C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\replays
```

### Mac
```
~/Library/Application Support/Steam/steamapps/common/dota 2 beta/game/dota/replays
```

### Linux
```
~/.steam/steam/steamapps/common/dota 2 beta/game/dota/replays
```

Replay files are named with Match IDs: `<match_id>.dem`

## 🚀 How to Use

1. **Download a replay** from your Dota 2 replays folder or from the game
2. Go to **Admin page** in your dashboard
3. Click the **"Replay (.dem)"** tab
4. Click **"Choose File"** and select your `.dem` file
5. Click **"Upload Replay"**
6. Wait 30-60 seconds for parsing
7. Done! Check the leaderboard to see updated stats

## 🔧 Technical Details

### Parser Library
- Uses **rapier** (OpenDota's JavaScript parser)
- Supports Dota 2 Source 2 replays
- Event-driven parsing system
- Extracts combat log and player events

### API Endpoint
- `POST /api/upload-replay`
- Max duration: 60 seconds
- Accepts multipart/form-data
- Returns match ID and player count

### Performance Score Calculation
```javascript
KDA = (Kills + Assists) / Deaths
FarmScore = (GPM + XPM) / 200
DamageScore = HeroDamage / 5000
PerformanceScore = (KDA * 2 + FarmScore + DamageScore) / 2
```

## ⚠️ Important Notes

### File Size
- Replay files can be 50-200MB
- Parsing takes 30-60 seconds depending on match length
- Progress indicator shown during upload

### Requirements
- Active season must exist in database
- Supabase credentials must be configured
- Node.js runtime (already configured)

### Current Limitations
- Processes one replay at a time
- Duplicate detection coming soon
- Player names extracted from combat log (may need manual cleanup)

## 🔄 CSV Upload Still Available

Don't have replay files? No problem!
- The CSV upload is still fully functional
- Use the **"CSV Upload"** tab
- Download sample CSV template
- Manual but gives you full control

## 📊 What Happens After Upload

1. Match data inserted into `matches` table
2. Player records created/updated in `players` table
3. Stats inserted into `player_match_stats` table
4. Upload logged in `uploads` table
5. Leaderboard recalculates automatically
6. All stats update in real-time

## 🐛 Troubleshooting

### "No active season found"
**Solution**: Run the SQL script at `/app/lib/supabase/add_seasons_table.sql` in your Supabase dashboard

### "Parse error"
**Solution**: Ensure the file is a valid `.dem` file from Dota 2. Old Source 1 replays are not supported.

### Parsing takes too long
**Normal**: Large matches (60+ minutes) can take up to 60 seconds to parse. Wait for completion.

### Players have generic names
**Solution**: The parser extracts names from combat logs. You may need to manually update player names in the database.

## 🎯 Next Steps

### For Users
1. Upload your first replay file
2. Check the leaderboard for updated stats
3. View player profiles to see detailed breakdowns
4. Upload more replays to build history

### For Developers
- Duplicate detection (check match ID before inserting)
- Batch upload support (multiple replays at once)
- Enhanced player name extraction
- Hero ability tracking
- Item build tracking

## 💡 Pro Tips

- **Download replays regularly**: Steam only keeps recent replays
- **Use CSV for bulk imports**: If you have historical data
- **Mix both methods**: Use replays for recent matches, CSV for old data
- **Check logs**: Look at `/api/upload-replay` logs for detailed parsing info

---

## 🎉 That's It!

You can now upload Dota 2 replays directly and have all the data automatically extracted and added to your dashboard. No more manual CSV creation!

**Live Dashboard**: https://inhouse-stats.preview.emergentagent.com

Enjoy your automated stats tracking! 🏆
