#!/usr/bin/env python3
"""
Dota 2 Inhouse Replay Parser
Extracts player stats from private lobby .dem files using smoke
"""
import sys
import json
import io
from smoke.io.wrap import demo as io_wrp_dm
from smoke.replay import demo as rply_dm
from smoke.replay.const import Data

def parse_inhouse_replay(dem_file_path):
    """Parse a Dota 2 replay file and extract player stats"""
    try:
        with io.open(dem_file_path, "rb") as infile:
            demo_io = io_wrp_dm.Wrap(infile)
            demo_io.bootstrap()

            # Parse only necessary data (skip voice and temp entities for speed)
            parse_flags = Data.All ^ (Data.VoiceData | Data.TempEntities)
            demo = rply_dm.Demo(demo_io, parse=parse_flags)
            demo.bootstrap()

            players = []
            match_info = {
                "duration": 0,
                "radiant_win": True
            }

            # Process the replay
            for match in demo.play():
                # Extract player data from entities
                if hasattr(match, 'entities'):
                    for entity in match.entities.values():
                        if hasattr(entity, 'cls') and 'Player' in str(entity.cls):
                            player_data = extract_player_stats(entity)
                            if player_data:
                                players.append(player_data)

                # Get match duration
                if hasattr(match, 'tick'):
                    match_info["duration"] = int(match.tick / 30)  # Convert ticks to seconds

            demo.finish()

            return {
                "success": True,
                "match_id": extract_match_id(dem_file_path),
                "players": players[:10],  # Limit to 10 players
                "radiant_win": match_info["radiant_win"],
                "duration": match_info["duration"]
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "tip": "Failed to parse replay. Make sure it's a valid Dota 2 Source 2 replay file."
        }

def extract_player_stats(entity):
    """Extract stats from a player entity"""
    try:
        return {
            "name": getattr(entity, 'm_iszPlayerName', f'Player_{id(entity)}'),
            "hero": getattr(entity, 'm_iPlayerSteamID', 'Unknown'),
            "team": 'radiant' if getattr(entity, 'm_iTeamNum', 2) == 2 else 'dire',
            "kills": getattr(entity, 'm_iKills', 0),
            "deaths": getattr(entity, 'm_iDeaths', 0),
            "assists": getattr(entity, 'm_iAssists', 0),
            "last_hits": getattr(entity, 'm_iLastHits', 0),
            "denies": getattr(entity, 'm_iDenies', 0),
            "gpm": getattr(entity, 'm_iGoldPerMin', 0),
            "xpm": getattr(entity, 'm_iExpPerMin', 0),
            "hero_damage": 0,
            "tower_damage": 0,
            "hero_healing": 0
        }
    except:
        return None

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
    result = parse_inhouse_replay(dem_file)
    print(json.dumps(result, indent=2))
