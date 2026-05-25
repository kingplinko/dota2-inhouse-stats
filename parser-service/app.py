from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import os
import json
from datetime import datetime
from supabase import create_client, Client

app = Flask(__name__)
CORS(app)

# Initialize Supabase client
def get_supabase():
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY')
    if not url or not key:
        raise Exception('SUPABASE_URL and SUPABASE_KEY must be set')
    return create_client(url, key)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'dota2-parser'})

@app.route('/parse-replay', methods=['POST'])
def parse_replay():
    """
    Parse replay from Supabase Storage and insert data into database
    
    Request body:
    {
        "replay_upload_id": "uuid"
    }
    """
    try:
        data = request.get_json()
        replay_upload_id = data.get('replay_upload_id')
        
        if not replay_upload_id:
            return jsonify({
                'success': False,
                'error': 'replay_upload_id is required'
            }), 400
        
        print(f"Processing replay upload: {replay_upload_id}")
        
        # Initialize Supabase
        supabase = get_supabase()
        
        # Step 1: Get upload record
        print("[Step 1] Fetching upload record...")
        upload_response = supabase.table('replay_uploads').select('*').eq('id', replay_upload_id).single().execute()
        
        if not upload_response.data:
            return jsonify({
                'success': False,
                'error': 'Upload record not found'
            }), 404
        
        upload = upload_response.data
        file_path = upload['file_path']
        
        # Step 2: Update status to parsing
        print("[Step 2] Updating status to parsing...")
        supabase.table('replay_uploads').update({
            'status': 'parsing'
        }).eq('id', replay_upload_id).execute()
        
        # Step 3: Download file from Supabase Storage
        print(f"[Step 3] Downloading file: {file_path}")
        file_data = supabase.storage.from_('replays').download(file_path)
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.dem') as tmp:
            tmp.write(file_data)
            tmp_path = tmp.name
        
        print(f"[Step 4] File saved to: {tmp_path} ({len(file_data)} bytes)")
        
        try:
            # Step 5: Parse the replay
            print("[Step 5] Parsing replay...")
            from awpy.parser import DemoParser
            
            parser = DemoParser(demofile=tmp_path, parse_rate=128)
            parsed_data = parser.parse()
            print("[Step 5] Parse complete!")
            
            # Step 6: Extract match data
            print("[Step 6] Extracting match data...")
            match_data = extract_match_data(parsed_data, upload['file_name'])
            
            # Step 7: Insert into database
            print("[Step 7] Inserting data into database...")
            result = insert_match_data(supabase, match_data, replay_upload_id)
            
            # Step 8: Update status to complete
            print("[Step 8] Updating status to complete...")
            supabase.table('replay_uploads').update({
                'status': 'complete',
                'match_id': result['match_id'],
                'parsed_at': datetime.utcnow().isoformat() + 'Z'
            }).eq('id', replay_upload_id).execute()
            
            print(f"✅ Successfully parsed replay! Match ID: {result['match_id']}")
            
            return jsonify({
                'success': True,
                'match_id': result['match_id'],
                'players_inserted': result['players_inserted'],
                'stats_inserted': result['stats_inserted']
            })
            
        except Exception as parse_error:
            print(f"❌ Parse error: {str(parse_error)}")
            
            # Update status to failed
            supabase.table('replay_uploads').update({
                'status': 'failed',
                'error_message': str(parse_error)
            }).eq('id', replay_upload_id).execute()
            
            return jsonify({
                'success': False,
                'error': f'Failed to parse replay: {str(parse_error)}'
            }), 500
        finally:
            # Cleanup temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    except Exception as e:
        print(f"❌ Request error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Request processing failed: {str(e)}'
        }), 500

def extract_match_data(parsed_data, filename):
    """Extract structured match data from parsed replay"""
    try:
        # Extract match ID from filename
        match_id = filename.replace('.dem', '').split('_')[-1]
        
        # Get game rounds (usually last round is the actual match)
        game_rounds = parsed_data.get('gameRounds', [])
        if not game_rounds:
            raise Exception('No game rounds found in replay')
        
        # Use the last round (full match)
        match_round = game_rounds[-1]
        
        # Extract basic match info
        radiant_win = match_round.get('winningTeam') == 'Radiant'
        duration = match_round.get('endTick', 0) // 30  # Convert ticks to seconds
        
        # Extract players
        players = []
        player_data = parsed_data.get('playerAtRoundEnd', {}).get('players', [])
        
        for i, player in enumerate(player_data[:10]):  # Limit to 10 players
            steam_id = player.get('steamID', f'unknown_{i}')
            player_name = player.get('name', f'Player {i+1}')
            hero_name = player.get('heroName', 'Unknown')
            team = 'radiant' if player.get('teamName') == 'Radiant' else 'dire'
            
            # Determine position (1-5) based on role or team position
            position = (i % 5) + 1
            
            # Determine if player won
            player_won = (team == 'radiant' and radiant_win) or (team == 'dire' and not radiant_win)
            
            players.append({
                'steam_id': str(steam_id),
                'player_name': player_name,
                'hero': hero_name,
                'position': position,
                'team': team,
                'result': 'win' if player_won else 'loss',
                'kills': player.get('kills', 0),
                'deaths': player.get('deaths', 0),
                'assists': player.get('assists', 0),
                'last_hits': player.get('lastHits', 0),
                'denies': player.get('denies', 0),
                'gpm': player.get('goldPerMin', 0),
                'xpm': player.get('xpPerMin', 0),
                'hero_damage': player.get('heroDamage', 0),
                'tower_damage': player.get('towerDamage', 0),
                'hero_healing': player.get('healing', 0)
            })
        
        return {
            'match_id': match_id,
            'match_date': datetime.utcnow().isoformat() + 'Z',
            'duration': duration,
            'radiant_win': radiant_win,
            'players': players
        }
    
    except Exception as e:
        raise Exception(f'Data extraction failed: {str(e)}')

def insert_match_data(supabase, match_data, replay_upload_id):
    """Insert match data into database"""
    try:
        # Get active season
        season_response = supabase.table('seasons').select('id').eq('is_active', True).limit(1).execute()
        
        if not season_response.data:
            raise Exception('No active season found')
        
        season_id = season_response.data[0]['id']
        
        # Insert match
        match_response = supabase.table('matches').insert({
            'season_id': season_id,
            'radiant_win': match_data['radiant_win'],
            'match_date': match_data['match_date'],
            'duration': match_data['duration']
        }).execute()
        
        match_id = match_response.data[0]['id']
        
        players_inserted = 0
        stats_inserted = 0
        
        # Insert players and stats
        for player_data in match_data['players']:
            # Upsert player
            player_response = supabase.table('players').upsert({
                'name': player_data['player_name']
            }, on_conflict='name').execute()
            
            player_id = player_response.data[0]['id']
            players_inserted += 1
            
            # Insert player match stats
            supabase.table('player_match_stats').insert({
                'match_id': match_id,
                'player_id': player_id,
                'hero': player_data['hero'],
                'position': player_data['position'],
                'team': player_data['team'],
                'kills': player_data['kills'],
                'deaths': player_data['deaths'],
                'assists': player_data['assists'],
                'last_hits': player_data['last_hits'],
                'denies': player_data['denies'],
                'gpm': player_data['gpm'],
                'xpm': player_data['xpm'],
                'hero_damage': player_data['hero_damage'],
                'tower_damage': player_data['tower_damage'],
                'hero_healing': player_data['hero_healing']
            }).execute()
            
            stats_inserted += 1
        
        return {
            'match_id': match_id,
            'players_inserted': players_inserted,
            'stats_inserted': stats_inserted
        }
    
    except Exception as e:
        raise Exception(f'Database insertion failed: {str(e)}')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
