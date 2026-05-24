'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSeasons()
  }, [])

  async function loadSeasons() {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) throw error

      // Get match counts for each season
      const seasonsWithStats = await Promise.all(
        (data || []).map(async (season) => {
          const { data: matches } = await supabase
            .from('matches')
            .select('id', { count: 'exact' })
            .eq('season_id', season.id)

          const { data: players } = await supabase
            .from('player_match_stats')
            .select('player_id')
            .in('match_id', matches?.map(m => m.id) || [])

          const uniquePlayers = new Set(players?.map(p => p.player_id) || []).size

          return {
            ...season,
            matchCount: matches?.length || 0,
            playerCount: uniquePlayers,
          }
        })
      )

      setSeasons(seasonsWithStats)
    } catch (error) {
      console.error('Error loading seasons:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Seasons</h1>
        <p className="text-gray-600 mt-1">All competitive seasons</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading seasons...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seasons.map((season) => (
            <Card key={season.id} className={season.is_active ? 'border-blue-500 border-2' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{season.name}</CardTitle>
                  {season.is_active && (
                    <Badge className="bg-blue-600">Active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600">Start Date</div>
                    <div className="font-medium">
                      {new Date(season.start_date).toLocaleDateString()}
                    </div>
                  </div>
                  {season.end_date && (
                    <div>
                      <div className="text-sm text-gray-600">End Date</div>
                      <div className="font-medium">
                        {new Date(season.end_date).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Matches</div>
                        <div className="text-2xl font-bold">{season.matchCount}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Players</div>
                        <div className="text-2xl font-bold">{season.playerCount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
