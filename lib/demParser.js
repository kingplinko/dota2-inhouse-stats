const fs = require('fs');
const rapier = require('rapier');

/**
 * Parse a Dota 2 .dem file and extract match data
 * @param {string} demFilePath - Path to the .dem file
 * @returns {Promise<Object>} Match data with players and stats
 */
async function parseDemFile(demFilePath) {
  return new Promise((resolve, reject) => {
    try {
      const buffer = fs.readFileSync(demFilePath);
      const parser = rapier.createParser();
      
      const matchData = {
        players: [],
        radiantWin: true,
        duration: 0,
        radiantScore: 0,
        direScore: 0
      };
      
      const playerMap = new Map();

      // Listen for game events
      parser.on('start', () => {
        console.log('Parser started');
      });

      parser.on('entity', (entity) => {
        if (entity.class === 'CDOTA_PlayerResource') {
          // Extract player data from PlayerResource entity
          for (let i = 0; i < 10; i++) {
            const playerName = entity.state[`m_vecPlayerTeamData.${i}.m_szPlayerName`];
            const steamId = entity.state[`m_vecPlayerData.${i}.m_iPlayerSteamID`];
            const heroId = entity.state[`m_vecPlayerData.${i}.m_nSelectedHeroID`];
            const kills = entity.state[`m_vecPlayerData.${i}.m_iKills`];
            const deaths = entity.state[`m_vecPlayerData.${i}.m_iDeaths`];
            const assists = entity.state[`m_vecPlayerData.${i}.m_iAssists`];
            const team = i < 5 ? 'radiant' : 'dire';
            
            if (playerName || steamId) {
              playerMap.set(i, {
                index: i,
                name: playerName || `Player${i + 1}`,
                steamId: steamId || '',
                heroId: heroId || 0,
                team: team,
                kills: kills || 0,
                deaths: deaths || 0,
                assists: assists || 0,
                lastHits: 0,
                denies: 0,
                gpm: 0,
                xpm: 0,
                heroDamage: 0,
                towerDamage: 0,
                heroHealing: 0
              });
            }
          }
        }
        
        // Extract hero entities for additional stats
        if (entity.class && entity.class.startsWith('CDOTA_Unit_Hero')) {
          const playerId = entity.state.m_iPlayerID;
          if (playerId !== undefined && playerMap.has(playerId)) {
            const player = playerMap.get(playerId);
            player.gpm = entity.state.m_iGoldPerMin || player.gpm;
            player.xpm = entity.state.m_iExpPerMin || player.xpm;
            player.lastHits = entity.state.m_iLastHits || player.lastHits;
            player.denies = entity.state.m_iDenies || player.denies;
          }
        }
      });

      parser.on('end', () => {
        console.log('Parser finished');
        
        // Convert player map to array
        matchData.players = Array.from(playerMap.values());
        
        // Calculate scores
        matchData.radiantScore = matchData.players
          .filter(p => p.team === 'radiant')
          .reduce((sum, p) => sum + p.kills, 0);
          
        matchData.direScore = matchData.players
          .filter(p => p.team === 'dire')
          .reduce((sum, p) => sum + p.kills, 0);
        
        resolve({
          success: true,
          matchData: matchData
        });
      });

      parser.on('error', (err) => {
        reject(new Error(`Parser error: ${err.message}`));
      });

      // Parse the buffer
      parser.parse(buffer);
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { parseDemFile };
