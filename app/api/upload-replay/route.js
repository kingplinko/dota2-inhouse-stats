import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    // Extract Match ID from filename
    const matchId = file.name.replace('.dem', '')
    
    if (!matchId || isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid .dem filename. Expected format: <matchid>.dem' }, { status: 400 })
    }

    // Fetch match data from OpenDota API
    const apiUrl = `https://api.opendota.com/api/matches/${matchId}`
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Match not found on OpenDota. The match may not be parsed yet or does not exist.',
        tip: 'Try uploading the replay to OpenDota first: https://www.opendota.com/request'
      }, { status: 404 })
    }

    const matchData = await response.json()

    // Initialize Supabase
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
      return NextResponse.json({ error: `Failed to create match: ${matchError.message}` }, { status: 500 })
    }

    // Process players
    let insertedCount = 0
    const players = matchData.players || []

    for (let i = 0; i < players.length; i++) {
      const playerData = players[i]
      
      // Determine team
      const team = i < 5 ? 'radiant' : 'dire'
      
      // Get or create player
      const playerName = playerData.personaname || `Player${playerData.player_slot}`
      
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
      const { error: statsError } = await supabase
        .from('player_match_stats')
        .insert({
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
      message: `Successfully imported match ${matchId}!`,
      matchId: matchId,
      playersProcessed: insertedCount,
      matchDuration: `${Math.floor(matchData.duration / 60)}:${(matchData.duration % 60).toString().padStart(2, '0')}`,
      winner: matchData.radiant_win ? 'Radiant' : 'Dire'
    })

  } catch (error) {
    console.error('Replay upload error:', error)
    return NextResponse.json({ error: `Failed to process replay: ${error.message}` }, { status: 500 })
  }
}

function getRankName(rankTier) {
  if (!rankTier) return 'Unranked'
  const ranks = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const tier = Math.floor(rankTier / 10)
  const stars = rankTier % 10
  return tier < ranks.length ? `${ranks[tier]} ${stars}` : 'Immortal'
}

function getHeroName(heroId) {
  // Simplified hero mapping - can be expanded
  const heroes = {
    1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 4: 'Bloodseeker', 5: 'Crystal Maiden',
    6: 'Drow Ranger', 7: 'Earthshaker', 8: 'Juggernaut', 9: 'Mirana', 10: 'Morphling',
    11: 'Shadow Fiend', 12: 'Phantom Lancer', 13: 'Puck', 14: 'Pudge', 15: 'Razor',
    16: 'Sand King', 17: 'Storm Spirit', 18: 'Sven', 19: 'Tiny', 20: 'Vengeful Spirit',
    // Add more as needed or fetch from OpenDota heroes API
  }
  return heroes[heroId] || `Hero ${heroId}`
}
