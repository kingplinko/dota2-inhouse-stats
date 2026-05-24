#!/usr/bin/env python3
"""
Dota 2 .dem file parser using demoparser2
"""
import sys
import json
from demoparser2 import DemoParser

def parse_dem(dem_path):
    try:
        parser = DemoParser(dem_path)
        
        # Get player info
        player_info = parser.parse_player_info()
        
        # Parse death events for K/D/A
        deaths = parser.parse_events("player_death")
        
        # Build player list
        players = []
        if player_info is not None and not player_info.empty:
            for idx, row in player_info.iterrows():
                # Calculate K/D/A from deaths dataframe
                kills = len(deaths[deaths['attacker'] == row['name']]) if deaths is not None else 0
                deaths_count = len(deaths[deaths['victim'] == row['name']]) if deaths is not None else 0
                
                players.append({
                    "name": str(row.get('name', f'Player{idx}')),
                    "steam_id": str(row.get('steamid', '')),
                    "hero": str(row.get('hero', 'Unknown')),
                    "team": "radiant" if idx < 5 else "dire",
                    "kills": kills,
                    "deaths": deaths_count,
                    "assists": 0,  # Would need to parse assist events
                    "last_hits": 0,
                    "denies": 0,
                    "gpm": 0,
                    "xpm": 0,
                    "hero_damage": 0,
                    "tower_damage": 0,
                    "hero_healing": 0,
                    "position": (idx % 5) + 1
                })
        
        return json.dumps({
            "success": True,
            "players": players,
            "radiant_win": True,
            "duration": 0,
            "match_id": extract_match_id(dem_path)
        }, indent=2)
        
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "tip": "Parser error - this may not be a supported Dota 2 replay format"
        }, indent=2)

def extract_match_id(filepath):
    import os
    return os.path.basename(filepath).replace('.dem', '')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file provided"}))
        sys.exit(1)
    
    print(parse_dem(sys.argv[1]))
