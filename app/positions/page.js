'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function PositionsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPositionStats()
  }, [])

  async function loadPositionStats() {
    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          radiant_win,
          player_match_stats(
            position,
            team,
            kills,
            deaths,
            assists,
            gpm,
            xpm
          )
        `)

      if (error) throw error

      const positionStats = {}

      matches.forEach(match => {
        match.player_match_stats.forEach(stat => {
          const pos = stat.position || 1
          if (!positionStats[pos]) {
            positionStats[pos] = {
              position: pos,
              games: 0,
              wins: 0,
              kills: 0,
              deaths: 0,
              assists: 0,
              gpm: 0,
              xpm: 0,
            }
          }

          positionStats[pos].games++
          positionStats[pos].kills += stat.kills
          positionStats[pos].deaths += stat.deaths
          positionStats[pos].assists += stat.assists
          positionStats[pos].gpm += stat.gpm
          positionStats[pos].xpm += stat.xpm

          const won = (stat.team === 'radiant' && match.radiant_win) ||
                     (stat.team === 'dire' && !match.radiant_win)
          if (won) positionStats[pos].wins++
        })
      })

      const positionNames = {
        1: 'Carry (Pos 1)',
        2: 'Mid (Pos 2)',
        3: 'Offlane (Pos 3)',
        4: 'Soft Support (Pos 4)',
        5: 'Hard Support (Pos 5)',
      }

      const positionData = Object.values(positionStats)
        .map(pos => ({
          ...pos,
          name: positionNames[pos.position] || `Position ${pos.position}`,
          winRate: parseFloat(((pos.wins / pos.games) * 100).toFixed(1)),
          avgKills: parseFloat((pos.kills / pos.games).toFixed(1)),
          avgDeaths: parseFloat((pos.deaths / pos.games).toFixed(1)),
          avgAssists: parseFloat((pos.assists / pos.games).toFixed(1)),
          avgGpm: parseInt(pos.gpm / pos.games),
          avgXpm: parseInt(pos.xpm / pos.games),
        }))
        .sort((a, b) => a.position - b.position)

      setData(positionData)
    } catch (error) {
      console.error('Error loading position stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Positions</h1>
        <p className="text-gray-600 mt-1">Role statistics and performance by position</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading position statistics...</div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4">
            {data.map((pos) => (
              <Card key={pos.position}>
                <CardHeader>
                  <CardTitle className="text-sm">{pos.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-600">Games</div>
                      <div className="text-xl font-bold">{pos.games}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Win Rate</div>
                      <div
                        className={`text-lg font-bold ${
                          pos.winRate >= 50 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {pos.winRate}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Average KDA by Position</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgKills" fill="#22c55e" name="Kills" />
                    <Bar dataKey="avgDeaths" fill="#ef4444" name="Deaths" />
                    <Bar dataKey="avgAssists" fill="#3b82f6" name="Assists" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Average Farm by Position</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgGpm" fill="#f59e0b" name="GPM" />
                    <Bar dataKey="avgXpm" fill="#8b5cf6" name="XPM" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Position Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Games</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wins</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg K/D/A</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg GPM</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg XPM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.map((pos) => (
                      <tr key={pos.position} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{pos.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{pos.games}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">{pos.wins}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={pos.winRate >= 50 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {pos.winRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pos.avgKills}/{pos.avgDeaths}/{pos.avgAssists}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{pos.avgGpm}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{pos.avgXpm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
