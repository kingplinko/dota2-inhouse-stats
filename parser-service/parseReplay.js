const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Parse Dota 2 .dem file using Manta
 * @param {string} demFilePath - Path to the .dem file
 * @returns {Promise<object>} Parsed match data
 */
async function parseReplayFile(demFilePath) {
  console.log('[parseReplayFile] Starting real .dem parsing...');
  console.log(`[parseReplayFile] File: ${demFilePath}`);
  
  try {
    // Check if file exists
    await fs.access(demFilePath);
    const stats = await fs.stat(demFilePath);
    console.log(`[parseReplayFile] File size: ${stats.size} bytes`);
    
    // Call Manta parser
    console.log('[parseReplayFile] Calling Manta parser...');
    const { stdout, stderr } = await execAsync(`manta -json ${demFilePath}`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
      timeout: 120000 // 2 minute timeout
    });
    
    if (stderr) {
      console.log('[parseReplayFile] Manta stderr:', stderr);
    }
    
    console.log('[parseReplayFile] Parsing Manta JSON output...');
    const mantaData = JSON.parse(stdout);
    
    console.log('[parseReplayFile] Manta data keys:', Object.keys(mantaData));
    
    // Extract match data from Manta output
    const matchData = extractMatchData(mantaData);
    
    console.log('[parseReplayFile] ✅ Successfully parsed replay!');
    console.log(`[parseReplayFile] Extracted ${matchData.players.length} players`);
    
    return matchData;
    
  } catch (error) {
    console.error('[parseReplayFile] ❌ Parsing failed:', error.message);
    
    if (error.code === 'ENOENT') {
      throw new Error('Manta parser not found - check Docker installation');
    }
    if (error.killed) {
      throw new Error('Parser timeout - file may be too large or corrupted');
    }
    
    throw new Error(`Failed to parse replay: ${error.message}`);
  }
}

/**
 * Extract structured match data from Manta output
 */
function extractMatchData(mantaData) {
  console.log('[extractMatchData] Extracting match data from Manta output...');
  
  // Manta output structure varies, adjust based on actual output
  // This is a template - needs to be adjusted based on real Manta JSON structure
  
  const players = [];
  const match = mantaData.match || {};
  const gameInfo = mantaData.game || {};
  
  // Extract players
  const playerList = mantaData.players || [];
  console.log(`[extractMatchData] Found ${playerList.length} players in Manta data`);
  
  for (const player of playerList) {
    const steamId = player.steamid || player.steam_id || `unknown_${players.length}`;
    const playerName = player.name || player.player_name || `Player ${players.length + 1}`;
    const hero = player.hero || player.hero_name || 'Unknown';
    const team = (player.team === 2 || player.team === 'radiant') ? 'radiant' : 'dire';
    
    // Determine win/loss
    const radiantWin = match.radiant_win || gameInfo.radiant_win || false;
    const won = (team === 'radiant' && radiantWin) || (team === 'dire' && !radiantWin);
    
    players.push({
      steam_id: String(steamId),
      player_name: playerName,
      hero: hero,
      position: player.position || (players.length % 5) + 1,
      team: team,
      result: won ? 'win' : 'loss',
      kills: player.kills || 0,
      deaths: player.deaths || 0,
      assists: player.assists || 0,
      gpm: player.gold_per_min || player.gpm || 0,
      xpm: player.xp_per_min || player.xpm || 0,
      damage: player.hero_damage || player.damage || 0,
      last_hits: player.last_hits || 0,
      denies: player.denies || 0,
      mmr_before: 0, // Not available in replay
      mmr_after: 0   // Not available in replay
    });
  }
  
  if (players.length === 0) {
    throw new Error('No players found in replay data');
  }
  
  return {
    match_id: match.match_id || gameInfo.match_id || '0',
    match_date: new Date().toISOString(),
    duration: match.duration || gameInfo.duration || 0,
    radiant_win: match.radiant_win || gameInfo.radiant_win || false,
    players: players
  };
}

module.exports = { parseReplayFile };
