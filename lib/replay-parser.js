import { Parser } from 'rapier'

export async function parseReplayFile(buffer) {
  return new Promise((resolve, reject) => {
    try {
      const parser = new Parser(buffer)
      
      const matchData = {
        players: [],
        matchInfo: {},
        combatLog: [],
      }

      let playerSlots = {}
      let heroes = {}
      let gameEndTime = 0

      // Get match info
      parser.on('CDemoFileInfo', (msg) => {
        matchData.matchInfo = {
          duration: msg.gameInfo?.dota?.gameTime || 0,
          matchId: msg.gameInfo?.dota?.matchId || Date.now(),
        }
      })

      // Track player info
      parser.on('CDOTAUserMsg_SpectatorPlayerClick', (msg) => {
        // Player selection events
      })

      // Get hero selections
      parser.on('CDOTAUserMsg_ChatMessage', (msg) => {
        // Chat messages can include hero picks
      })

      // Combat log for kills, deaths, assists
      parser.on('CMsgDOTACombatLogEntry', (entry) => {
        matchData.combatLog.push({
          type: entry.type,
          timestamp: entry.timestamp,
          attackerName: entry.attackerName,
          targetName: entry.targetName,
          value: entry.value,
        })
      })

      // Game end
      parser.on('CDOTAUserMsg_ChatEvent', (msg) => {
        if (msg.type === 10) { // Game end event
          gameEndTime = msg.timestamp || 0
        }
      })

      // Parse completion
      parser.on('end', () => {
        // Calculate stats from combat log
        const playerStats = calculatePlayerStats(matchData.combatLog)
        
        matchData.players = Object.values(playerStats)
        matchData.matchInfo.gameEndTime = gameEndTime
        
        resolve(matchData)
      })

      parser.on('error', (err) => {
        reject(new Error(`Parse error: ${err.message}`))
      })

      // Start parsing
      parser.parse()
    } catch (error) {
      reject(error)
    }
  })
}

function calculatePlayerStats(combatLog) {
  const stats = {}

  combatLog.forEach((entry) => {
    const attacker = entry.attackerName
    const target = entry.targetName

    // Initialize player stats
    if (attacker && !stats[attacker]) {
      stats[attacker] = {
        name: attacker,
        kills: 0,
        deaths: 0,
        assists: 0,
        heroDamage: 0,
        towerDamage: 0,
        healing: 0,
      }
    }

    if (target && !stats[target]) {
      stats[target] = {
        name: target,
        kills: 0,
        deaths: 0,
        assists: 0,
        heroDamage: 0,
        towerDamage: 0,
        healing: 0,
      }
    }

    // Count kills and deaths
    if (entry.type === 0) { // Kill event
      if (attacker) stats[attacker].kills++
      if (target) stats[target].deaths++
    }

    // Track damage
    if (entry.value && attacker) {
      if (entry.type === 1) { // Hero damage
        stats[attacker].heroDamage += entry.value
      } else if (entry.type === 2) { // Tower damage
        stats[attacker].towerDamage += entry.value
      } else if (entry.type === 3) { // Healing
        stats[attacker].healing += entry.value
      }
    }
  })

  return stats
}

export function formatReplayDataForDB(parsedData) {
  // Format the parsed replay data into our database schema
  const players = parsedData.players.map((player, index) => ({
    name: player.name || `Player${index + 1}`,
    hero: player.hero || 'Unknown',
    team: player.team || (index < 5 ? 'radiant' : 'dire'),
    kills: player.kills || 0,
    deaths: player.deaths || 0,
    assists: player.assists || 0,
    lastHits: player.lastHits || 0,
    denies: player.denies || 0,
    gpm: player.gpm || 0,
    xpm: player.xpm || 0,
    heroDamage: player.heroDamage || 0,
    towerDamage: player.towerDamage || 0,
    heroHealing: player.healing || 0,
    position: player.position || (index % 5) + 1,
  }))

  return {
    matchInfo: {
      duration: parsedData.matchInfo.duration || 0,
      matchDate: new Date().toISOString(),
      radiantWin: parsedData.matchInfo.radiantWin !== false,
    },
    players,
  }
}
