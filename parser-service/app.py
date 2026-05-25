from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import os
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'dota2-parser'})

@app.route('/parse', methods=['POST'])
def parse_replay():
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file uploaded'
            }), 400
        
        file = request.files['file']
        
        if not file.filename.endswith('.dem'):
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Must be .dem file'
            }), 400
        
        # Save to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.dem') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        print(f"Processing file: {file.filename}")
        print(f"Temp path: {tmp_path}")
        print(f"File size: {os.path.getsize(tmp_path)} bytes")
        
        try:
            # Import parser (awpy)
            from awpy.parser import DemoParser
            
            # Parse the replay
            print("Starting parse...")
            parser = DemoParser(demofile=tmp_path, parse_rate=128)
            data = parser.parse()
            print("Parse complete!")
            
            # Extract match data
            result = extract_match_data(data, file.filename)
            
            return jsonify(result)
            
        except Exception as parse_error:
            print(f"Parse error: {str(parse_error)}")
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
        print(f"Request error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Request processing failed: {str(e)}'
        }), 500

def extract_match_data(parsed_data, filename):
    """
    Extract structured match data from parsed replay
    """
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
            'success': True,
            'match_id': match_id,
            'match_date': datetime.utcnow().isoformat() + 'Z',
            'duration': duration,
            'radiant_win': radiant_win,
            'players': players
        }
    
    except Exception as e:
        raise Exception(f'Data extraction failed: {str(e)}')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
