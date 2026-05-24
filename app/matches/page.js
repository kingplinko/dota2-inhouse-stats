'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    loadSeasons()
  }, [])

  useEffect(() => {
    loadMatches()
  }, [selectedSeason])

  async function loadSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })
    
    if (data) setSeasons(data)
  }

  async function loadMatches() {
    try {
      let query = supabase
        .from('matches')
        .select(`
          id,
          match_date,
          radiant_win,
          duration,
          player_match_stats(
            hero,
            team,
            kills,
            deaths,
            assists,
            player:players(name)
          )
        `)
        .order('match_date', { ascending: false })
        .limit(50)

      if (selectedSeason !== 'all') {
        query = query.eq('season_id', selectedSeason)
      }

      const { data, error } = await query

      if (error) throw error
      setMatches(data || [])
    } catch (error) {
      console.error('Error loading matches:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
          <p className="text-gray-600 mt-1">Recent match history</p>
        </div>
        <div className="w-48">
          <Select value={selectedSeason} onValueChange={setSelectedSeason}>
            <SelectTrigger>
              <SelectValue placeholder="Select season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {season.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="p-12 text-center text-gray-500">No matches found</div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const radiantTeam = match.player_match_stats.filter(s => s.team === 'radiant')
            const direTeam = match.player_match_stats.filter(s => s.team === 'dire')

            return (
              <Card key={match.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {new Date(match.match_date).toLocaleString()}
                    </div>
                    <div className="flex items-center space-x-4">
                      {match.duration && (
                        <div className="text-sm text-gray-600">
                          Duration: {Math.floor(match.duration / 60)}:{(match.duration % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Radiant Team */}
                    <div className={`rounded-lg p-4 ${match.radiant_win ? 'bg-green-50 border-2 border-green-500' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">Radiant</h3>
                        {match.radiant_win && (
                          <span className="text-green-600 font-bold">VICTORY</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {radiantTeam.map((stat, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{stat.player?.name || 'Unknown'}</span>
                              <span className="text-gray-600">-</span>
                              <span className="text-blue-600">{stat.hero}</span>
                            </div>
                            <div className="font-mono">
                              {stat.kills}/{stat.deaths}/{stat.assists}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dire Team */}
                    <div className={`rounded-lg p-4 ${!match.radiant_win ? 'bg-green-50 border-2 border-green-500' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg">Dire</h3>
                        {!match.radiant_win && (
                          <span className="text-green-600 font-bold">VICTORY</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {direTeam.map((stat, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{stat.player?.name || 'Unknown'}</span>
                              <span className="text-gray-600">-</span>
                              <span className="text-blue-600">{stat.hero}</span>
                            </div>
                            <div className="font-mono">
                              {stat.kills}/{stat.deaths}/{stat.assists}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
