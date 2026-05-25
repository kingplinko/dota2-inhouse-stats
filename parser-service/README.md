# Dota 2 Replay Parser Service

This microservice parses Dota 2 .dem replay files and returns structured JSON data.

## API Endpoints

### Health Check
```
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "service": "dota2-parser"
}
```

### Parse Replay
```
POST /parse
Content-Type: multipart/form-data

Body:
- file: <.dem file>
```

Returns:
```json
{
  "success": true,
  "match_id": "8823519575",
  "match_date": "2026-05-25T14:30:00Z",
  "duration": 2543,
  "radiant_win": false,
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
      "hero_healing": 0
    }
  ]
}
```

## Local Development

```bash
pip install -r requirements.txt
python app.py
```

## Docker Build

```bash
docker build -t dota2-parser .
docker run -p 5000:5000 dota2-parser
```

## Deploy to Railway

See RAILWAY_DEPLOY.md for detailed instructions.
