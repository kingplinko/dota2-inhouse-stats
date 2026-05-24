import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for parsing

export async function POST(request) {
  try {
    const { uploadId, filePath } = await request.json()

    if (!uploadId || !filePath) {
      return NextResponse.json({ error: 'Missing uploadId or filePath' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    )

    // Update status to parsing
    await supabase
      .from('replay_uploads')
      .update({ status: 'parsing' })
      .eq('id', uploadId)

    console.log(`Starting to parse replay: ${filePath}`)

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('replays')
      .download(filePath)

    if (downloadError) {
      await supabase
        .from('replay_uploads')
        .update({ 
          status: 'failed', 
          error_message: `Download failed: ${downloadError.message}` 
        })
        .eq('id', uploadId)
      
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 })
    }

    // Save to temporary location
    const fs = require('fs').promises
    const path = require('path')
    const tmpPath = path.join('/tmp', `replay_${uploadId}.dem`)
    
    const buffer = Buffer.from(await fileData.arrayBuffer())
    await fs.writeFile(tmpPath, buffer)

    console.log(`File saved to: ${tmpPath}`)

    // Extract match ID from filename
    const matchId = path.basename(filePath).replace('.dem', '')

    // Try Steam API first (for public matches)
    const steamApiKey = process.env.STEAM_API_KEY
    if (steamApiKey) {
      const steamUrl = `https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/?match_id=${matchId}&key=${steamApiKey}`
      
      console.log('Checking Steam API...')
      const steamResponse = await fetch(steamUrl)
      
      if (steamResponse.ok) {
        const steamData = await steamResponse.json()
        
        if (steamData.result) {
          console.log('Match found on Steam API! Importing...')
          const result = await importMatchData(steamData.result, matchId, supabase)
          
          if (result.success) {
            await supabase
              .from('replay_uploads')
              .update({ 
                status: 'complete', 
                match_id: matchId,
                parsed_at: new Date().toISOString()
              })
              .eq('id', uploadId)

            // Cleanup
            await fs.unlink(tmpPath).catch(() => {})
            
            return NextResponse.json({
              success: true,
              message: `Match ${matchId} imported successfully from Steam API!`,
              playersProcessed: result.playersProcessed
            })
          }
        }
      }
    }

    // Steam API didn't have it - this is an inhouse/private match
    console.log('Steam API unavailable - inhouse match detected')
    
    // Update status to show we need a parser implementation
    await supabase
      .from('replay_uploads')
      .update({ 
        status: 'uploaded',
        match_id: matchId,
        error_message: 'Uploaded - waiting for .dem parser implementation. File stored in storage.'
      })
      .eq('id', uploadId)

    // Cleanup
    await fs.unlink(tmpPath).catch(() => {})

    return NextResponse.json({
      success: true,
      status: 'uploaded',
      message: 'Replay uploaded successfully. Parser implementation pending.',
      matchId: matchId,
      note: 'The .dem file is stored and ready. A parser needs to be implemented to extract match data.'
    })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ 
      error: `Parse failed: ${error.message}` 
    }, { status: 500 })
  }
}

async function importMatchData(matchData, matchId, supabase) {
  // Get active season
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single()

  if (!season) {
    throw new Error('No active season found')
  }

  // Create match
  const { data: match } = await supabase
    .from('matches')
    .insert({
      season_id: season.id,
      radiant_win: matchData.radiant_win,
      match_date: new Date(matchData.start_time * 1000).toISOString(),
      duration: matchData.duration,
    })
    .select()
    .single()

  if (!match) {
    throw new Error('Failed to create match')
  }

  // Process players
  let insertedCount = 0
  const players = matchData.players || []

  for (let i = 0; i < players.length; i++) {
    const playerData = players[i]
    const team = playerData.player_slot < 128 ? 'radiant' : 'dire'
    const playerName = playerData.persona || playerData.account_id || `Player${i + 1}`
    
    // Get or create player
    let { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('name', playerName)
      .single()

    if (!player) {
      const { data: newPlayer } = await supabase
        .from('players')
        .insert({ name: playerName })
        .select()
        .single()
      player = newPlayer
    }

    if (!player) continue

    const kda = playerData.deaths > 0 
      ? (playerData.kills + playerData.assists) / playerData.deaths 
      : playerData.kills + playerData.assists
    const performanceScore = Math.min(10, (kda * 2 + (playerData.gold_per_min + playerData.xp_per_min) / 200) / 2)
    const position = (playerData.player_slot % 128 % 5) + 1

    await supabase.from('player_match_stats').insert({
      match_id: match.id,
      player_id: player.id,
      hero: getHeroName(playerData.hero_id),
      position: position,
      team: team,
      kills: playerData.kills || 0,
      deaths: playerData.deaths || 0,
      assists: playerData.assists || 0,
      last_hits: playerData.last_hits || 0,
      denies: playerData.denies || 0,
      gpm: playerData.gold_per_min || 0,
      xpm: playerData.xp_per_min || 0,
      hero_damage: playerData.hero_damage || 0,
      tower_damage: playerData.tower_damage || 0,
      hero_healing: playerData.hero_healing || 0,
      performance_score: performanceScore,
    })

    insertedCount++
  }

  await supabase.from('uploads').insert({
    file_name: `${matchId}.dem`,
    row_count: insertedCount,
    status: 'completed',
  })

  return { success: true, playersProcessed: insertedCount }
}

function getHeroName(heroId) {
  const heroes = {
    1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 4: 'Bloodseeker', 5: 'Crystal Maiden',
    6: 'Drow Ranger', 7: 'Earthshaker', 8: 'Juggernaut', 9: 'Mirana', 10: 'Morphling',
    11: 'Shadow Fiend', 12: 'Phantom Lancer', 13: 'Puck', 14: 'Pudge', 15: 'Razor',
    16: 'Sand King', 17: 'Storm Spirit', 18: 'Sven', 19: 'Tiny', 20: 'Vengeful Spirit',
    21: 'Windranger', 22: 'Zeus', 23: 'Kunkka', 25: 'Lina', 26: 'Lion',
    27: 'Shadow Shaman', 28: 'Slardar', 29: 'Tidehunter', 30: 'Witch Doctor', 31: 'Lich',
    32: 'Riki', 33: 'Enigma', 34: 'Tinker', 35: 'Sniper', 36: 'Necrophos',
    37: 'Warlock', 38: 'Beastmaster', 39: 'Queen of Pain', 40: 'Venomancer', 41: 'Faceless Void',
    42: 'Wraith King', 43: 'Death Prophet', 44: 'Phantom Assassin', 45: 'Pugna', 46: 'Templar Assassin',
    47: 'Viper', 48: 'Luna', 49: 'Dragon Knight', 50: 'Dazzle', 51: 'Clockwerk',
    52: 'Leshrac', 53: "Nature's Prophet", 54: 'Lifestealer', 55: 'Dark Seer', 56: 'Clinkz',
    57: 'Omniknight', 58: 'Enchantress', 59: 'Huskar', 60: 'Night Stalker', 61: 'Broodmother',
    62: 'Bounty Hunter', 63: 'Weaver', 64: 'Jakiro', 65: 'Batrider', 66: 'Chen',
    67: 'Spectre', 68: 'Ancient Apparition', 69: 'Doom', 70: 'Ursa', 71: 'Spirit Breaker',
    72: 'Gyrocopter', 73: 'Alchemist', 74: 'Invoker', 75: 'Silencer', 76: 'Outworld Destroyer',
    77: 'Lycan', 78: 'Brewmaster', 79: 'Shadow Demon', 80: 'Lone Druid', 81: 'Chaos Knight',
    82: 'Meepo', 83: 'Treant Protector', 84: 'Ogre Magi', 85: 'Undying', 86: 'Rubick',
    87: 'Disruptor', 88: 'Nyx Assassin', 89: 'Naga Siren', 90: 'Keeper of the Light', 91: 'Io',
    92: 'Visage', 93: 'Slark', 94: 'Medusa', 95: 'Troll Warlord', 96: 'Centaur Warrunner',
    97: 'Magnus', 98: 'Timbersaw', 99: 'Bristleback', 100: 'Tusk', 101: 'Skywrath Mage',
    102: 'Abaddon', 103: 'Elder Titan', 104: 'Legion Commander', 105: 'Techies', 106: 'Ember Spirit',
    107: 'Earth Spirit', 108: 'Underlord', 109: 'Terrorblade', 110: 'Phoenix', 111: 'Oracle',
    112: 'Winter Wyvern', 113: 'Arc Warden', 114: 'Monkey King', 119: 'Dark Willow', 120: 'Pangolier',
    121: 'Grimstroke', 123: 'Hoodwink', 126: 'Void Spirit', 128: 'Snapfire', 129: 'Mars',
    135: 'Dawnbreaker', 136: 'Marci', 137: 'Primal Beast', 138: 'Muerta', 145: 'Ringmaster',
    146: 'Kez'
  }
  return heroes[heroId] || `Hero ${heroId}`
}
