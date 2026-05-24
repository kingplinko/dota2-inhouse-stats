import { NextResponse } from 'next/server'
import { parseReplayFile, formatReplayDataForDB } from '@/lib/replay-parser'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for parsing

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Check file extension
    if (!file.name.endsWith('.dem')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .dem file' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse the replay file
    console.log('Parsing replay file...')
    const parsedData = await parseReplayFile(buffer)
    
    // Format data for database
    const dbData = formatReplayDataForDB(parsedData)

    // Initialize Supabase client
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
      return NextResponse.json(
        { error: 'No active season found. Please create an active season first.' },
        { status: 400 }
      )
    }

    // Insert match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        season_id: season.id,
        radiant_win: dbData.matchInfo.radiantWin,
        match_date: dbData.matchInfo.matchDate,
        duration: dbData.matchInfo.duration,
      })
      .select()
      .single()

    if (matchError) {
      console.error('Match insert error:', matchError)
      return NextResponse.json(
        { error: `Failed to create match: ${matchError.message}` },
        { status: 500 }
      )
    }

    // Insert players and their stats
    let insertedCount = 0
    for (const playerData of dbData.players) {
      // Get or create player
      let { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('name', playerData.name)
        .single()

      if (!player) {
        const { data: newPlayer } = await supabase
          .from('players')
          .insert({ name: playerData.name })
          .select()
          .single()
        player = newPlayer
      }

      if (!player) continue

      // Insert player match stats
      const { error: statsError } = await supabase
        .from('player_match_stats')
        .insert({
          match_id: match.id,
          player_id: player.id,
          hero: playerData.hero,
          position: playerData.position,
          team: playerData.team,
          kills: playerData.kills,
          deaths: playerData.deaths,
          assists: playerData.assists,
          last_hits: playerData.lastHits,
          denies: playerData.denies,
          gpm: playerData.gpm,
          xpm: playerData.xpm,
          hero_damage: playerData.heroDamage,
          tower_damage: playerData.towerDamage,
          hero_healing: playerData.heroHealing,
          performance_score: calculatePerformanceScore(playerData),
        })

      if (!statsError) insertedCount++
    }

    // Log upload
    await supabase.from('uploads').insert({
      file_name: file.name,
      row_count: insertedCount,
      status: 'completed',
    })

    return NextResponse.json({
      success: true,
      message: `Successfully parsed replay and inserted ${insertedCount} players`,
      matchId: match.id,
      playersProcessed: insertedCount,
    })
  } catch (error) {
    console.error('Replay upload error:', error)
    return NextResponse.json(
      { error: `Failed to process replay: ${error.message}` },
      { status: 500 }
    )
  }
}

function calculatePerformanceScore(playerData) {
  // Simple performance calculation based on KDA and farm
  const kda = playerData.deaths > 0
    ? (playerData.kills + playerData.assists) / playerData.deaths
    : playerData.kills + playerData.assists
  
  const farmScore = (playerData.gpm + playerData.xpm) / 200
  const damageScore = playerData.heroDamage / 5000
  
  return Math.min(10, (kda * 2 + farmScore + damageScore) / 2)
}
