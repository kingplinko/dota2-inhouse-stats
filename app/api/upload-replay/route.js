import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large replays

export async function POST(request) {
  let tempFilePath = ''
  
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.dem')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a .dem file' }, { status: 400 })
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    tempFilePath = path.join('/tmp', `replay_${Date.now()}_${file.name}`)
    await writeFile(tempFilePath, buffer)

    console.log(`Saved replay to: ${tempFilePath}`)
    console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

    // Try parsing with Python
    console.log('Starting Python parser...')
    const { stdout, stderr } = await execAsync(`python3 /app/lib/parse_replay.py "${tempFilePath}"`, {
      timeout: 120000, // 2 minutes
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    })

    if (stderr) {
      console.error('Parser stderr:', stderr)
    }

    const parseResult = JSON.parse(stdout)
    
    if (!parseResult.success) {
      // Fallback to OpenDota API method
      const matchId = file.name.replace('.dem', '')
      return await fetchFromOpenDota(matchId)
    }

    // Process the parsed data
    return await insertMatchData(parseResult)

  } catch (error) {
    console.error('Replay processing error:', error)
    
    // Fallback: try OpenDota API
    try {
      const matchId = request.formData.get('file')?.name?.replace('.dem', '')
      if (matchId) {
        console.log(`Falling back to OpenDota API for match ${matchId}`)
        return await fetchFromOpenDota(matchId)
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
    }

    return NextResponse.json({ 
      error: `Failed to process replay: ${error.message}`,
      details: 'The parser encountered an error. Please ensure you have a valid Dota 2 Source 2 replay file.',
      fallback: 'You can also try uploading the match to OpenDota.com/request first, then upload the .dem file here.'
    }, { status: 500 })
  } finally {
    // Cleanup
    if (tempFilePath) {
      try {
        await execAsync(`rm -f "${tempFilePath}"`)
      } catch (e) {
        console.error('Cleanup error:', e)
      }
    }
  }
}

async function fetchFromOpenDota(matchId) {
  const apiUrl = `https://api.opendota.com/api/matches/${matchId}`
  const response = await fetch(apiUrl)
  
  if (!response.ok) {
    return NextResponse.json({ 
      error: 'Unable to parse replay and match not found on OpenDota.',
      suggestion: 'Upload your replay to https://www.opendota.com/request first, wait 2-5 minutes, then try again.'
    }, { status: 404 })
  }

  const matchData = await response.json()
  return await insertMatchDataFromOpenDota(matchData, matchId)
}

async function insertMatchDataFromOpenDota(matchData, matchId) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  )

  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single()

  if (!season) {
    return NextResponse.json({ error: 'No active season found' }, { status: 400 })
  }

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
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }

  let insertedCount = 0
  const players = matchData.players || []

  for (let i = 0; i < players.length; i++) {
    const playerData = players[i]
    const team = i < 5 ? 'radiant' : 'dire'
    const playerName = playerData.personaname || `Player${playerData.player_slot}`
    
    let { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('name', playerName)
      .single()

    if (!player) {
      const { data: newPlayer } = await supabase
        .from('players')
        .insert({ name: playerName, dota_rank: getRankName(playerData.rank_tier) })
        .select()
        .single()
      player = newPlayer
    }

    if (!player) continue

    const kda = playerData.deaths > 0 
      ? (playerData.kills + playerData.assists) / playerData.deaths 
      : playerData.kills + playerData.assists
    const performanceScore = Math.min(10, (kda * 2 + (playerData.gold_per_min + playerData.xp_per_min) / 200) / 2)

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

  await supabase.from('uploads').insert({
    file_name: `${matchId}.dem`,
    row_count: insertedCount,
    status: 'completed',
  })

  return NextResponse.json({
    success: true,
    message: `Successfully imported match ${matchId} from OpenDota!`,
    matchId: matchId,
    playersProcessed: insertedCount,
    source: 'OpenDota API'
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
  }
  return heroes[heroId] || `Hero ${heroId}`
}
