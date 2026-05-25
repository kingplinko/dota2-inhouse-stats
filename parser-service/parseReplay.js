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
    
    // Call Manta parser (Go binary)
    console.log('[parseReplayFile] Calling dota-parser binary...');
    const { stdout, stderr } = await execAsync(`dota-parser ${demFilePath}`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
      timeout: 120000 // 2 minute timeout
    });
    
    if (stderr) {
      console.log('[parseReplayFile] Parser stderr:', stderr);
    }
    
    if (!stdout || stdout.trim().length === 0) {
      throw new Error('Parser returned empty output');
    }
    
    console.log('[parseReplayFile] Raw parser output:');
    console.log(stdout);
    
    console.log('[parseReplayFile] Parsing JSON output...');
    const parsedData = JSON.parse(stdout);
    
    console.log('[parseReplayFile] Manta data keys:', Object.keys(parsedData));
    
    // Extract match data from parser output
    const matchData = extractMatchData(parsedData);
    
    console.log('[parseReplayFile] ✅ Successfully parsed replay!');
    console.log(`[parseReplayFile] Extracted ${matchData.players.length} players`);
    
    return matchData;
    
  } catch (error) {
    console.error('[parseReplayFile] ❌ Parsing failed:', error.message);
    
    if (error.message.includes('dota-parser')) {
      throw new Error('Dota parser binary not found or not working - check Docker build');
    }
    if (error.code === 'ENOENT') {
      throw new Error('Parser binary not found - check installation');
    }
    if (error.killed) {
      throw new Error('Parser timeout - file may be too large or corrupted');
    }
    
    throw new Error(`Real .dem parsing failed: ${error.message}`);
  }
}

/**
 * Extract structured match data from parser output
 */
function extractMatchData(parsedData) {
  console.log('[extractMatchData] Extracting match data from parser output...');
  console.log('[extractMatchData] Raw data:', JSON.stringify(parsedData).substring(0, 500));
  
  const players = [];
  const playerList = parsedData.players || [];
  
  console.log(`[extractMatchData] Found ${playerList.length} players in parsed data`);
  
  if (playerList.length === 0) {
    throw new Error('No players found in parser output - real parsing may have failed');
  }
  
  for (const player of playerList) {
    const steamId = player.steam_id || `unknown_${players.length}`;
    const playerName = player.player_name || `Unknown Player ${players.length + 1}`;
    
    if (playerName.includes('Player ') && playerName.match(/Player \d+/)) {
      console.warn('[extractMatchData] WARNING: Player name looks like mock data:', playerName);
    }
    
    players.push({
      steam_id: String(steamId),
      player_name: playerName,
      hero: player.hero || 'Unknown',
      position: player.position || (players.length % 5) + 1,
      team: player.team || 'radiant',
      result: player.result || 'unknown',
      kills: player.kills || 0,
      deaths: player.deaths || 0,
      assists: player.assists || 0,
      gpm: player.gpm || 0,
      xpm: player.xpm || 0,
      damage: player.hero_damage || player.damage || 0,
      last_hits: player.last_hits || 0,
      denies: player.denies || 0,
      mmr_before: 0,
      mmr_after: 0
    });
  }
  
  console.log('[extractMatchData] Extracted players:', players.map(p => p.player_name).join(', '));
  
  return {
    match_id: parsedData.match_id || '0',
    match_date: new Date().toISOString(),
    duration: parsedData.duration || 0,
    radiant_win: parsedData.radiant_win || false,
    players: players
  };
}

module.exports = { parseReplayFile };
