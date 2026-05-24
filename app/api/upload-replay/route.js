import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import FormData from 'form-data'
import fetch from 'node-fetch'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.dem')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a .dem file' }, { status: 400 })
    }

    const matchId = file.name.replace('.dem', '')
    console.log(`Processing match ID: ${matchId}`)

    // Step 1: Check if already parsed on OpenDota
    console.log('Checking if match already exists on OpenDota...')
    const checkUrl = `https://api.opendota.com/api/matches/${matchId}`
    const checkResponse = await fetch(checkUrl)
    
    if (checkResponse.ok) {
      console.log('Match already parsed! Importing directly...')
      const matchData = await checkResponse.json()
      return await importMatchData(matchData, matchId, file.name)
    }

    // Step 2: Submit replay to OpenDota for parsing
    console.log('Match not found. Submitting to OpenDota for parsing...')
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    
    const uploadForm = new FormData()
    uploadForm.append('replay_blob', fileBuffer, {
      filename: file.name,
      contentType: 'application/octet-stream'
    })

    const uploadResponse = await fetch('https://api.opendota.com/api/request/submit', {
      method: 'POST',
      body: uploadForm,
      headers: uploadForm.getHeaders()
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('OpenDota upload failed:', errorText)
      return NextResponse.json({ 
        error: 'Failed to submit replay to OpenDota',
        details: errorText,
        tip: 'The replay file may be invalid or too large'
      }, { status: 500 })
    }

    const uploadResult = await uploadResponse.json()
    console.log('Upload result:', uploadResult)

    // Step 3: Poll for parsing completion
    console.log('Polling for parse completion...')
    let attempts = 0
    const maxAttempts = 30 // 30 attempts = ~2.5 minutes
    
    while (attempts < maxAttempts) {
      await sleep(5000) // Wait 5 seconds between checks
      
      const pollResponse = await fetch(checkUrl)
      if (pollResponse.ok) {
        console.log('Parsing complete! Importing data...')
        const matchData = await pollResponse.json()
        return await importMatchData(matchData, matchId, file.name)
      }
      
      attempts++
      console.log(`Polling attempt ${attempts}/${maxAttempts}...`)
    }

    // Parsing is taking too long
    return NextResponse.json({
      success: false,
      message: 'Replay submitted to OpenDota but parsing is taking longer than expected.',
      matchId: matchId,
      tip: 'Check back in a few minutes and upload the .dem file again, or visit OpenDota.com directly.',
      status: 'parsing'
    })

  } catch (error) {
    console.error('Replay processing error:', error)
    return NextResponse.json({ 
      error: `Failed to process replay: ${error.message}`,
      stack: error.stack
    }, { status: 500 })
  }
}

async function importMatchData(matchData, matchId, fileName) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  )

  // Get active season
  const { data: season, error: seasonError } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single()

  if (seasonError || !season) {
    return NextResponse.json({ 
      error: 'No active season found. Please create an active season first.',
      tip: 'Run the seasons SQL setup script in your Supabase dashboard'
    }, { status: 400 })
  }

  // Create match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      season_id: season.id,
      radiant_win: matchData.radiant_win,
      match_date: new Date(matchData.start_time * 1000).toISOString(),
      duration: matchData.duration,
    })
    .select()
    .single()

  if (matchError) {
    console.error('Match insert error:', matchError)
    return NextResponse.json({ 
      error: `Failed to create match: ${matchError.message}` 
    }, { status: 500 })
  }

  // Process players
  let insertedCount = 0
  const players = matchData.players || []

  for (let i = 0; i < players.length; i++) {
    const playerData = players[i]
    const team = i < 5 ? 'radiant' : 'dire'
    const playerName = playerData.personaname || `Player${playerData.player_slot}`
    
    // Get or create player
    let { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('name', playerName)
      .single()

    if (!player) {
      const { data: newPlayer } = await supabase
        .from('players')
        .insert({ 
          name: playerName,
          dota_rank: getRankName(playerData.rank_tier)
        })
        .select()
        .single()
      player = newPlayer
    }

    if (!player) continue

    // Calculate performance score
    const kda = playerData.deaths > 0 
      ? (playerData.kills + playerData.assists) / playerData.deaths 
      : playerData.kills + playerData.assists
    const performanceScore = Math.min(10, (kda * 2 + (playerData.gold_per_min + playerData.xp_per_min) / 200) / 2)

    // Insert player stats
    await supabase.from('player_match_stats').insert({
      match_id: match.id,
      player_id: player.id,
      hero: getHeroName(playerData.hero_id),
      position: playerData.lane_role || ((i % 5) + 1),
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

  // Log upload
  await supabase.from('uploads').insert({
    file_name: fileName,
    row_count: insertedCount,
    status: 'completed',
  })

  return NextResponse.json({
    success: true,
    message: `🎉 Successfully imported match ${matchId}!`,
    matchId: matchId,
    playersProcessed: insertedCount,
    matchDuration: `${Math.floor(matchData.duration / 60)}:${(matchData.duration % 60).toString().padStart(2, '0')}`,
    winner: matchData.radiant_win ? 'Radiant' : 'Dire'
  })
}

function getRankName(rankTier) {
  if (!rankTier) return 'Unranked'
  const ranks = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  return tier < ranks.length ? `${ranks[tier]} ${stars}` : 'Immortal'
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
