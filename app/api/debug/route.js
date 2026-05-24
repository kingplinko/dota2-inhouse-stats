import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    )

    // Check seasons
    const { data: seasons, error: seasonError } = await supabase
      .from('seasons')
      .select('*')

    // Check players
    const { data: players, error: playerError } = await supabase
      .from('players')
      .select('*')

    // Check matches
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')

    // Check player_match_stats
    const { data: stats, error: statsError } = await supabase
      .from('player_match_stats')
      .select('*')

    return NextResponse.json({
      seasons: {
        count: seasons?.length || 0,
        data: seasons,
        error: seasonError?.message
      },
      players: {
        count: players?.length || 0,
        data: players,
        error: playerError?.message
      },
      matches: {
        count: matches?.length || 0,
        data: matches,
        error: matchError?.message
      },
      stats: {
        count: stats?.length || 0,
        error: statsError?.message
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
