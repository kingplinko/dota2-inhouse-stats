#!/usr/bin/env python3
"""
Dota 2 Replay Parser
Extracts match data from .dem files using demoparser2
"""
import sys
import json
from demoparser2 import DemoParser

def parse_replay(dem_file_path):
    """Parse a Dota 2 replay file and return match data as JSON"""
    try:
        parser = DemoParser(dem_file_path)
        
        # Get match info
        df = parser.parse_event("dota_combatlog", player=["hero", "attacker", "target"])
        
        # Get player data - using game_events for player info
        players_df = parser.parse_event("player_connect_full", player=["steamid", "name"])
        
        # Parse the replay
        result = {
            "success": True,
            "match_id": extract_match_id(dem_file_path),
            "players": [],
            "duration": 0,
            "radiant_win": True
        }
        
        # Try to get basic player stats
        if players_df is not None and not players_df.empty:
            for idx, row in players_df.iterrows():
                player_data = {
                    "name": row.get("name", f"Player{idx}"),
                    "steamid": row.get("steamid", ""),
                    "team": "radiant" if idx < 5 else "dire",
                    "hero": row.get("hero", "Unknown"),
                    "kills": 0,
                    "deaths": 0,
                    "assists": 0,
                    "gpm": 0,
                    "xpm": 0,
                    "last_hits": 0,
                    "denies": 0,
                    "hero_damage": 0,
                    "tower_damage": 0,
                    "hero_healing": 0
                }
                result["players"].append(player_data)
        
        return json.dumps(result, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "tip": "Make sure the .dem file is a valid Dota 2 Source 2 replay"
        }, indent=2)

def extract_match_id(filepath):
    """Extract match ID from filename"""
    import os
    filename = os.path.basename(filepath)
    return filename.replace('.dem', '')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
    
    dem_file = sys.argv[1]
    result = parse_replay(dem_file)
    print(result)
