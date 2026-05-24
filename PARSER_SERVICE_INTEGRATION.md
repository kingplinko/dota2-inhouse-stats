# Parser Service Integration Architecture

## Overview
This document outlines the architecture for integrating an external .dem replay parser microservice with the Dota 2 Inhouse Stats Dashboard.

**Status:** Architecture ready, implementation pending external parser service deployment

---

## Current State (Phase 1 - Complete ✅)

### What Works:
- ✅ `.dem` file upload to Supabase Storage bucket `replays`
- ✅ `replay_uploads` database table tracking with status management
- ✅ Honest user messaging: "parser service not connected"
- ✅ CSV upload as the working alternative
- ✅ All pages (Leaderboard, Players, Heroes, etc.) use real database data only
- ✅ Clear warning banners on Admin and Replays pages

### What's Pending:
- ⏳ Connection to external parser microservice
- ⏳ Actual `.dem` file parsing for private/inhouse matches
- ⏳ Automatic data population from parsed replays

---

## Phase 2: External Parser Service Integration

### Architecture Overview

```
[User] → [Upload .dem] → [Supabase Storage]
                              ↓
                    [replay_uploads table: status="parser_pending"]
                              ↓
                    [Next.js API: /api/parse-replay]
                              ↓
                    [External Parser Microservice]
                              ↓
                    [Parsed JSON Response]
                              ↓
      [Database Transaction: matches, players, player_match_stats]
                              ↓
                    [Leaderboard Updates]
```

---

## Environment Variables Required

Add these to `/app/.env`:

```bash
# Parser Service Configuration
PARSER_SERVICE_ENABLED=false              # Set to true when parser is deployed
PARSER_SERVICE_URL=https://parser.example.com/parse
PARSER_SERVICE_API_KEY=your_secret_key    # Optional: for authenticated requests
PARSER_SERVICE_TIMEOUT=120000             # Timeout in ms (default: 120s)
```

---

## Parser Service Contract

### Request (From Next.js to Parser Service)

**Endpoint:** `POST {PARSER_SERVICE_URL}`

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer {PARSER_SERVICE_API_KEY}  (if required)
```

**Body:**
```
Form Data:
- file: <binary .dem file>
- match_id: "8823519575" (extracted from filename)
```

### Response (From Parser Service to Next.js)

**Success Response (200 OK):**
```json
{
  "success": true,
  "match_id": "8823519575",
  "match_date": "2026-05-25T14:30:00Z",
  "duration": 2543,
  "radiant_win": false,
  "dire_win": true,
  "players": [
    {
      "steam_id": "76561198123456789",
      "player_name": "PlayerName",
      "hero": "Anti-Mage",
      "position": 1,
      "team": "radiant",
      "result": "loss",
      "kills": 8,
      "deaths": 5,
      "assists": 12,
      "last_hits": 320,
      "denies": 15,
      "gpm": 580,
      "xpm": 650,
      "hero_damage": 25000,
      "tower_damage": 3200,
      "hero_healing": 0,
      "level": 25,
      "networth": 18500,
      "items": ["black_king_bar", "manta_style", "abyssal_blade"]
    },
    // ... 9 more players (10 total)
  ]
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Failed to parse replay: corrupted file",
  "details": "Additional error context (optional)"
}
```

---

## Implementation Steps

### Step 1: Update Environment Variables
```bash
# In /app/.env
PARSER_SERVICE_ENABLED=true
PARSER_SERVICE_URL=https://your-deployed-parser.com/parse
PARSER_SERVICE_API_KEY=your_actual_key
```

### Step 2: Update `/app/lib/parserService.js`

Replace the placeholder implementation with:

```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function parseReplayWithExternalService(filePath) {
  if (process.env.PARSER_SERVICE_ENABLED !== 'true') {
    throw new Error('Replay uploaded, but parser service is not connected yet. Implementation pending.');
  }

  const parserUrl = process.env.PARSER_SERVICE_URL;
  const apiKey = process.env.PARSER_SERVICE_API_KEY;
  const timeout = parseInt(process.env.PARSER_SERVICE_TIMEOUT || '120000');

  if (!parserUrl) {
    throw new Error('PARSER_SERVICE_URL not configured');
  }

  try {
    // Create form data with the .dem file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // Prepare request headers
    const headers = {
      ...form.getHeaders()
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Send file to parser service
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(parserUrl, {
      method: 'POST',
      body: form,
      headers: headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Parser service error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Parser service returned unsuccessful response');
    }

    return {
      match: {
        radiant_win: result.radiant_win,
        duration: result.duration,
        match_date: result.match_date
      },
      players: result.players.map(p => ({
        name: p.player_name,
        hero: p.hero,
        team: p.team,
        position: p.position,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        last_hits: p.last_hits,
        denies: p.denies,
        gpm: p.gpm,
        xpm: p.xpm,
        hero_damage: p.hero_damage,
        tower_damage: p.tower_damage,
        hero_healing: p.hero_healing
      }))
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Parser service timeout - file too large or service unresponsive');
    }
    throw error;
  }
}

module.exports = { parseReplayWithExternalService };
```

### Step 3: Update Status Flow

The existing `/app/app/api/parse-replay/route.js` already has the correct flow:

1. ✅ Downloads `.dem` file from Supabase Storage
2. ✅ Sets status to `parser_pending`
3. ✅ Calls `parseReplayWithExternalService()`
4. ✅ On success: Inserts into database, sets status to `complete`
5. ✅ On failure: Sets status to `failed`, logs error message

**No code changes needed** - just set `PARSER_SERVICE_ENABLED=true` when ready!

### Step 4: Test the Integration

```bash
# 1. Upload a .dem file via /replays page
# 2. Check replay_uploads table status changes:
#    uploaded → parser_pending → complete

# 3. Verify data in database:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM player_match_stats;"

# 4. Check leaderboard auto-populates
```

---

## Parser Service Options

### Option A: Deploy Your Own
Build a parser microservice using:
- **Python:** `awpy`, `demoparser2`
- **Go:** `manta`, `smoke`
- **Node.js:** `clarity`, `rapier` (may require native bindings)

Deploy on:
- AWS Lambda (with increased timeout/memory)
- Google Cloud Run
- Azure Functions
- Dedicated VPS/Kubernetes cluster

### Option B: Use Third-Party Service
- OpenDota API (only works for public matches, not private lobbies)
- Custom hosted solution

### Option C: Hybrid Approach
- Public matches: Use OpenDota API
- Private matches: Require CSV upload (current working method)

---

## Database Transaction Flow

When parser returns data, the system:

1. **Get Active Season**
   ```sql
   SELECT id FROM seasons WHERE is_active = true LIMIT 1;
   ```

2. **Insert Match**
   ```sql
   INSERT INTO matches (season_id, radiant_win, match_date, duration)
   VALUES ($1, $2, $3, $4) RETURNING id;
   ```

3. **Upsert Players** (for each of 10 players)
   ```sql
   INSERT INTO players (name) VALUES ($1)
   ON CONFLICT (name) DO NOTHING
   RETURNING id;
   ```

4. **Insert Player Stats** (for each of 10 players)
   ```sql
   INSERT INTO player_match_stats (
     match_id, player_id, hero, position, team,
     kills, deaths, assists, gpm, xpm, hero_damage, ...
   ) VALUES ($1, $2, $3, ...);
   ```

5. **Update Upload Record**
   ```sql
   UPDATE replay_uploads
   SET status = 'complete', match_id = $1, parsed_at = NOW()
   WHERE id = $2;
   ```

All wrapped in a transaction - if any step fails, entire operation rolls back.

---

## Status Values

| Status | Meaning |
|--------|---------|
| `uploaded` | File successfully stored in Supabase, waiting for trigger |
| `parser_pending` | Parser service not connected yet |
| `parsing` | Actively being parsed by external service |
| `complete` | Successfully parsed and data inserted |
| `failed` | Parsing or insertion failed, check error_message |

---

## Monitoring & Debugging

### Check Upload Status
```sql
SELECT id, file_name, status, error_message, created_at, parsed_at
FROM replay_uploads
ORDER BY created_at DESC
LIMIT 10;
```

### Check Recent Matches
```sql
SELECT m.id, m.match_date, m.duration, COUNT(pms.id) as player_count
FROM matches m
LEFT JOIN player_match_stats pms ON m.id = pms.match_id
GROUP BY m.id
ORDER BY m.match_date DESC
LIMIT 10;
```

### View API Logs
```bash
tail -f /var/log/supervisor/nextjs.out.log | grep "Parse Replay"
```

---

## Security Considerations

1. **API Key Protection:** Store `PARSER_SERVICE_API_KEY` securely, never commit to git
2. **File Validation:** Parser service should validate .dem file integrity
3. **Rate Limiting:** Implement rate limits on `/api/parse-replay` to prevent abuse
4. **Timeout Handling:** Set reasonable timeouts (120s recommended for large files)
5. **Error Logging:** Never expose internal errors to users, log them server-side

---

## Cost Estimation

### Per Replay Parse:
- **File Transfer:** 50-200MB download from Supabase Storage (~$0.01-0.05)
- **Parser Service Compute:** Varies by provider (AWS Lambda: ~$0.02-0.10)
- **Database Writes:** ~11 rows (1 match + 10 stats) - negligible
- **Total:** ~$0.03-0.15 per replay

### For 100 Matches/Month:
- **Low estimate:** $3/month
- **High estimate:** $15/month

---

## Fallback Strategy

If parser service becomes unavailable:

1. System automatically detects `PARSER_SERVICE_ENABLED=false` or timeout
2. Updates status to `parser_pending` instead of `failed`
3. Users see clear message: "Parser service not connected"
4. CSV upload remains fully functional as backup method
5. No data loss - files remain in Supabase Storage for retry

---

## Next Steps

✅ **Phase 1 Complete:** UI messaging, CSV workflow, database structure
⏳ **Phase 2 Pending:** Deploy parser microservice, configure environment variables
🚀 **Phase 3 Future:** Admin UI for parser configuration, batch processing, retry logic

---

## Support

For questions about this integration, see:
- `/app/lib/parserService.js` - Parser service client code
- `/app/app/api/parse-replay/route.js` - API route handler
- `/app/QUICK_START.md` - General setup guide
- `/app/DATABASE_SETUP.md` - Database schema reference
