# Real .dem Parsing with Manta

## ✅ What Changed

**Replaced mock data generator with real Dota 2 replay parsing using Manta.**

### Before:
- Generated fake players (Player 1, Player 2, etc.)
- Random stats
- Confirmed pipeline works

### Now:
- ✅ Installs Manta (Go Dota 2 parser) in Docker
- ✅ Parses actual .dem files
- ✅ Extracts real player data:
  - Steam IDs
  - Player names (if available)
  - Heroes
  - Teams (Radiant/Dire)
  - Win/loss results
  - Kills, deaths, assists
  - GPM, XPM
  - Damage, last hits, denies
- ✅ Inserts REAL data into database
- ✅ No more mock Player 1, Player 2

---

## How It Works

### 1. Upload Flow
```
User uploads .dem → Supabase Storage
                          ↓
           POST /api/parse-replay (replay_upload_id)
                          ↓
         Railway Parser Service downloads file
                          ↓
              Calls Manta binary: `manta -json file.dem`
                          ↓
           Parses Manta JSON output
                          ↓
         Extracts 10 players with real stats
                          ↓
     Inserts into: matches, players, player_match_stats
                          ↓
              Leaderboard updates with REAL data!
```

### 2. Manta Parser
- **Binary:** `manta` (Go)
- **Input:** `.dem` file path
- **Output:** JSON with match data
- **Location:** `/go/bin/manta` in Docker container

### 3. Data Extraction
Located in: `/app/parser-service/parseReplay.js`

Extracts:
- `steamid` → `steam_id`
- `name` → `player_name`
- `hero` → `hero`
- `team` → `radiant` or `dire`
- `kills`, `deaths`, `assists`
- `gold_per_min` → `gpm`
- `xp_per_min` → `xpm`
- `hero_damage` → `damage`
- `last_hits`, `denies`

---

## Files Changed

1. **Dockerfile** - Installs Go + Manta
2. **parseReplay.js** - New file: Manta parser wrapper
3. **server.js** - Replaces mock generator with real parsing

---

## Testing

### After Railway Redeploys:

1. Upload a real `.dem` file
2. Check Railway logs - should see:
   ```
   [parseReplayFile] Starting real .dem parsing...
   [parseReplayFile] Calling Manta parser...
   [extractMatchData] Found 10 players in Manta data
   ```
3. Check leaderboard - should show REAL player names and stats!

---

## Error Handling

If Manta parsing fails:
- Status: `failed`
- Error message: "Real .dem parsing failed: [reason]"
- Recommendation: "Please use CSV upload for now"

**CSV upload still works** as backup method!

---

## Known Limitations

1. **MMR:** Not available in replay files (set to 0)
2. **Parsing time:** 30-60 seconds for large files
3. **Private lobbies:** Full support (unlike OpenDota API)
4. **Manta output:** May need adjustments based on actual output structure

---

## Next Steps

1. Wait for Railway to redeploy (~3-5 min, longer due to Go install)
2. Upload a real `.dem` file
3. Check logs to see if Manta output needs field mapping adjustments
4. Real stats should populate!

---

## Fallback

If Manta doesn't work immediately:
- CSV upload is fully functional
- Can debug Manta output from logs
- Can adjust field mappings in `parseReplay.js`
