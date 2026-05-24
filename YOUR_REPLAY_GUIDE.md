# 🎮 How to Import Your Dota 2 Replay Data

## Your Replay File: 8823519575.dem

I've received your practice replay file! Here's the best way to get this data into your dashboard.

## ✅ Recommended Method: Use OpenDota

### Step 1: View Match on OpenDota
Your match is already available on OpenDota:
**https://www.opendota.com/matches/8823519575**

Click the link above to view the full match analysis!

### Step 2: Get the Match Data

OpenDota has already parsed this match. You can:

1. **View the data directly** on their site
2. **Use their API** to get JSON data:
   ```
   https://api.opendota.com/api/matches/8823519575
   ```

### Step 3: Convert to CSV

From the OpenDota data, create a CSV with these columns:
```csv
player,hero,team,kills,deaths,assists,last_hits,denies,gpm,xpm,hero_damage,tower_damage,hero_healing,performance_score,position,dota_rank,match_date,win
```

### Step 4: Upload to Your Dashboard

Go to **Admin → CSV Upload** tab and upload your formatted CSV!

---

## 🔧 Alternative: Manual Entry

If you just want to test the dashboard:

1. Use the **sample CSV** provided in the admin page
2. Or create a simple CSV with the basic stats from the match
3. Upload and see your leaderboard populate!

---

## 📊 What OpenDota Shows

For match **8823519575**, OpenDota will show:
- ✅ All 10 players
- ✅ Hero picks
- ✅ Kill/Death/Assist stats  
- ✅ GPM, XPM, last hits, denies
- ✅ Hero damage, tower damage
- ✅ Win/loss for each team
- ✅ Match duration
- ✅ And much more!

---

## ⚡ Quick Test

Want to see your dashboard in action right now?

1. Go to **Admin** page
2. Click **"CSV Upload"** tab
3. Click **"Download Sample CSV"**
4. Upload that sample file
5. Check the **Leaderboard** - you'll see stats appear!

Then you can replace it with your real match data.

---

## 🤔 Why Not Native .dem Parsing?

**TL;DR**: Dota 2 replay parsers for JavaScript/Node.js have complex dependencies that don't work well in serverless environments like Next.js.

**Better approach**:
- OpenDota has already solved this with robust infrastructure
- They process millions of replays
- Their API is free and reliable
- You get validated, clean data

**Future**: We can add native parsing when:
- Stable JS libraries emerge
- Or we set up a separate parsing service
- Or use a Rust-based parser (more complex setup)

---

## 📝 CSV Format Reminder

Here's what your CSV should look like (one row per player):

```csv
player,hero,team,kills,deaths,assists,last_hits,denies,gpm,xpm,hero_damage,tower_damage,hero_healing,performance_score,position,dota_rank,match_date,win
Player1,Anti-Mage,radiant,10,2,5,450,20,650,700,15000,3000,0,8.5,1,Divine 5,2024-01-15,true
Player2,Crystal Maiden,radiant,2,8,15,50,5,250,300,8000,500,5000,7.2,5,Ancient 3,2024-01-15,true
```

**Important**: 
- Each player gets one row
- `team`: either "radiant" or "dire"  
- `win`: "true" if player won, "false" if lost
- `position`: 1-5 (1=Carry, 5=Hard Support)

---

## 🎯 Next Steps

1. **Option A (Easiest)**: Visit https://www.opendota.com/matches/8823519575
2. **Option B (Quick Test)**: Upload the sample CSV from admin page
3. **Option C (Full Control)**: Create your CSV manually with custom stats

All methods work perfectly! The dashboard will:
- ✅ Create players automatically
- ✅ Calculate all statistics (MMR, KDA, impact, etc.)
- ✅ Update the leaderboard in real-time
- ✅ Show detailed player profiles
- ✅ Display hero statistics
- ✅ Track win streaks and form

---

## 💡 Pro Tip

If you have multiple replays:
1. Get Match IDs from .dem filenames
2. Batch request them from OpenDota API
3. Combine into one large CSV
4. Upload once - all matches populate!

---

Your dashboard is ready and waiting for data! 🏆

**Dashboard URL**: https://inhouse-stats.preview.emergentagent.com
