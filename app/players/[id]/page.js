'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Trophy, Target, TrendingUp, Gamepad2 } from 'lucide-react'

export default function PlayerProfilePage() {
  const params = useParams()
  const [player, setPlayer] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPlayerData()
  }, [params.id])

  async function loadPlayerData() {
    try {
      // Get player
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('id', params.id)
        .single()

      if (!playerData) return

      setPlayer(playerData)

      // Get player's matches with stats
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          id,
          match_date,
          radiant_win,
          player_match_stats!inner(
            player_id,
            hero,
            team,
            kills,
            deaths,
            assists,
            gpm,
            xpm,
            performance_score,
            position
          )
        `)
        .eq('player_match_stats.player_id', params.id)
        .order('match_date', { ascending: true })

      if (!matches) return

      // Calculate stats
      const playerStats = matches.map(m => m.player_match_stats[0])
      const wins = matches.filter(match => {
        const stat = match.player_match_stats[0]
        return (stat.team === 'radiant' && match.radiant_win) ||
               (stat.team === 'dire' && !match.radiant_win)
      }).length

      const totalGames = matches.length
      const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : 0

      const avgKills = (playerStats.reduce((sum, s) => sum + s.kills, 0) / totalGames).toFixed(1)
      const avgDeaths = (playerStats.reduce((sum, s) => sum + s.deaths, 0) / totalGames).toFixed(1)
      const avgAssists = (playerStats.reduce((sum, s) => sum + s.assists, 0) / totalGames).toFixed(1)
      const kda = avgDeaths > 0 ? ((parseFloat(avgKills) + parseFloat(avgAssists)) / parseFloat(avgDeaths)).toFixed(2) : 0

      // MMR over time (simulated)
      const mmrHistory = matches.map((match, index) => {
        const stat = match.player_match_stats[0]
        const won = (stat.team === 'radiant' && match.radiant_win) ||
                    (stat.team === 'dire' && !match.radiant_win)
        const mmrChange = won ? 25 : -25
        const mmr = 2000 + (index * 10) + mmrChange
        return {
          game: index + 1,
          mmr: mmr,
          date: new Date(match.match_date).toLocaleDateString()
        }
      })

      // Position breakdown
      const positionStats = {}
      playerStats.forEach(stat => {
        const pos = stat.position || 1
        if (!positionStats[pos]) {
          positionStats[pos] = { games: 0, wins: 0 }
        }
        positionStats[pos].games++
      })

      matches.forEach((match, index) => {
        const stat = match.player_match_stats[0]
        const pos = stat.position || 1
        const won = (stat.team === 'radiant' && match.radiant_win) ||
                    (stat.team === 'dire' && !match.radiant_win)
        if (won) positionStats[pos].wins++
      })

      const positionData = Object.entries(positionStats).map(([pos, data]) => ({
        position: `Pos ${pos}`,
        games: data.games,
        winRate: ((data.wins / data.games) * 100).toFixed(1)
      }))

      // Hero performance
      const heroStats = {}
      playerStats.forEach(stat => {
        if (!heroStats[stat.hero]) {
          heroStats[stat.hero] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
        }
        heroStats[stat.hero].games++
        heroStats[stat.hero].kills += stat.kills
        heroStats[stat.hero].deaths += stat.deaths
        heroStats[stat.hero].assists += stat.assists
      })

      matches.forEach((match, index) => {
        const stat = match.player_match_stats[0]
        const won = (stat.team === 'radiant' && match.radiant_win) ||
                    (stat.team === 'dire' && !match.radiant_win)
        if (won) heroStats[stat.hero].wins++
      })

      const topHeroes = Object.entries(heroStats)
        .map(([hero, data]) => ({
          hero,
          games: data.games,
          winRate: ((data.wins / data.games) * 100).toFixed(1),
          kda: data.deaths > 0 ? ((data.kills + data.assists) / data.deaths).toFixed(2) : 0
        }))
        .sort((a, b) => b.games - a.games)
        .slice(0, 5)

      setStats({
        totalGames,
        wins,
        losses: totalGames - wins,
        winRate,
        avgKills,
        avgDeaths,
        avgAssists,
        kda,
        mmrHistory,
        positionData,
        topHeroes,
        recentMatches: matches.slice(-10).reverse()
      })
    } catch (error) {
      console.error('Error loading player data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading player profile...</div>
      </div>
    )
  }

  if (!player || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Player not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-blue-600">
              {player.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{player.name}</h1>
            <p className="text-gray-600">{player.dota_rank || 'Unranked'}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Games Played</CardTitle>
            <Gamepad2 className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGames}</div>
            <p className="text-xs text-green-600">{stats.wins}W - {stats.losses}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Trophy className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${parseFloat(stats.winRate) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.winRate}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KDA</CardTitle>
            <Target className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.kda}</div>
            <p className="text-xs text-gray-600">{stats.avgKills}/{stats.avgDeaths}/{stats.avgAssists}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7.5</div>
            <p className="text-xs text-gray-600">out of 10</p>
          </CardContent>
        </Card>
      </div>

      {/* MMR History Chart */}
      <Card>
        <CardHeader>
          <CardTitle>MMR History</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.mmrHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="game" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="mmr" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Position Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Position Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.positionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="games" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Heroes */}
        <Card>
          <CardHeader>
            <CardTitle>Top Heroes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topHeroes.map((hero, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{hero.hero}</div>
                    <div className="text-sm text-gray-600">{hero.games} games</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${parseFloat(hero.winRate) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                      {hero.winRate}%
                    </div>
                    <div className="text-sm text-gray-600">KDA: {hero.kda}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Matches */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.recentMatches.map((match, index) => {
              const stat = match.player_match_stats[0]
              const won = (stat.team === 'radiant' && match.radiant_win) ||
                         (stat.team === 'dire' && !match.radiant_win)
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-2 h-2 rounded-full ${won ? 'bg-green-600' : 'bg-red-600'}`} />
                    <div>
                      <div className="font-medium">{stat.hero}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(match.match_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{stat.kills}/{stat.deaths}/{stat.assists}</div>
                    <div className="text-sm text-gray-600">Pos {stat.position}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
