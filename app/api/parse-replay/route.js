import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Backend Replay Parsing Workflow
 * 
 * Flow:
 * 1. Receive uploadId and filePath
 * 2. Update status to "parsing"
 * 3. Download .dem file from Supabase Storage
 * 4. Call external parser service
 * 5. Insert match, players, and stats into database
 * 6. Update status to "complete"
 * 7. Return success
 */
export async function POST(request) {
  let tmpPath = ''
  
  try {
    const { uploadId, filePath } = await request.json()

    if (!uploadId || !filePath) {
      return NextResponse.json({ 
        error: 'Missing uploadId or filePath' 
      }, { status: 400 })
    }

    console.log(`[Parse Replay] Starting workflow for upload: ${uploadId}`)
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    )

    // Step 1: Update status to "parsing"
    console.log('[Step 1] Updating status to parsing...')
    await supabase
      .from('replay_uploads')
      .update({ status: 'parsing' })
      .eq('id', uploadId)

    // Step 2: Download .dem file from Supabase Storage
    console.log('[Step 2] Downloading file from storage...')
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('replays')
      .download(filePath)

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`)
    }

    // Step 3: Save to temporary location
    tmpPath = path.join('/tmp', `replay_${uploadId}.dem`)
    const buffer = Buffer.from(await fileData.arrayBuffer())
    await writeFile(tmpPath, buffer)
    console.log(`[Step 3] File saved to: ${tmpPath}`)

    // Step 4: Extract match ID from filename
    const matchId = path.basename(filePath).replace('.dem', '').split('_').pop()
    console.log(`[Step 4] Match ID: ${matchId}`)

    // Step 5: Call parser service
    console.log('[Step 5] Calling parser service...')
    const { parseReplayWithExternalService } = require('@/lib/parserService')
    
    let parsedData
    try {
      parsedData = await parseReplayWithExternalService(tmpPath)
    } catch (parserError) {
      // Parser not connected yet - update status and return
      await supabase
        .from('replay_uploads')
        .update({ 
          status: 'uploaded',
          match_id: matchId,
          error_message: parserError.message
        })
        .eq('id', uploadId)

      await unlink(tmpPath).catch(() => {})

      return NextResponse.json({
        success: true,
        status: 'uploaded',
        message: 'Replay uploaded successfully',
        note: parserError.message,
        matchId: matchId
      })
    }

    // Step 6: Insert data into database
    console.log('[Step 6] Inserting data into database...')
    const result = await insertMatchData(parsedData, matchId, supabase)

    // Step 7: Update status to "complete"
    console.log('[Step 7] Updating status to complete...')
    await supabase
      .from('replay_uploads')
      .update({ 
        status: 'complete',
        match_id: matchId,
        parsed_at: new Date().toISOString()
      })
      .eq('id', uploadId)

    // Cleanup
    await unlink(tmpPath).catch(() => {})

    console.log('[Complete] Replay parsed successfully!')
    return NextResponse.json({
      success: true,
      message: `Match ${matchId} imported successfully!`,
      playersProcessed: result.playersProcessed,
      matchId: matchId
    })

  } catch (error) {
    console.error('[Error]', error)

    // Update status to failed
    if (request.body?.uploadId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      )
      
      await supabase
        .from('replay_uploads')
        .update({ 
          status: 'failed',
          error_message: error.message
        })
        .eq('id', request.body.uploadId)
    }

    // Cleanup
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {})
    }

    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}

/**
 * Insert match data into database
 * Creates match, players (if needed), and player_match_stats
 */
async function insertMatchData(parsedData, matchId, supabase) {
  // Get active season
  const { data: season } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single()

  if (!season) {
    throw new Error('No active season found')
  }

  // Insert match
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      season_id: season.id,
      radiant_win: parsedData.match.radiant_win,
      match_date: parsedData.match.match_date || new Date().toISOString(),
      duration: parsedData.match.duration,
    })
    .select()
    .single()

  if (matchError) {
    throw new Error(`Failed to insert match: ${matchError.message}`)
  }

  let playersProcessed = 0

  // Insert players and stats
  for (const playerData of parsedData.players) {
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

    // Calculate performance score
    const kda = playerData.deaths > 0 
      ? (playerData.kills + playerData.assists) / playerData.deaths 
      : playerData.kills + playerData.assists
    const performanceScore = Math.min(10, (kda * 2 + (playerData.gpm + playerData.xpm) / 200) / 2)

    // Insert player match stats
    await supabase
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
        last_hits: playerData.last_hits,
        denies: playerData.denies,
        gpm: playerData.gpm,
        xpm: playerData.xpm,
        hero_damage: playerData.hero_damage,
        tower_damage: playerData.tower_damage,
        hero_healing: playerData.hero_healing,
        performance_score: performanceScore,
      })

    playersProcessed++
  }

  // Log upload
  await supabase
    .from('uploads')
    .insert({
      file_name: `${matchId}.dem`,
      row_count: playersProcessed,
      status: 'completed',
    })

  return { playersProcessed }
}
