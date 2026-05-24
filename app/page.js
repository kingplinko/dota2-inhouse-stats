'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ArrowUpDown, Search, TrendingUp, TrendingDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function LeaderboardPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState('all')
  const [globalFilter, setGlobalFilter] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadSeasons()
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [selectedSeason])

  async function loadSeasons() {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })
    
    if (data) {
      setSeasons(data)
    }
  }

  async function loadLeaderboard() {
    setLoading(true)
    try {
      // Get all players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')

      if (playersError) throw playersError

      // Get all matches with stats
      let matchesQuery = supabase
        .from('matches')
        .select(`
          id,
          season_id,
          radiant_win,
          match_date,
          player_match_stats!inner(
            player_id,
            team,
            kills,
            deaths,
            assists,
            performance_score
          )
        `)
      
      if (selectedSeason !== 'all') {
        matchesQuery = matchesQuery.eq('season_id', selectedSeason)
      }

      const { data: matches, error: matchesError } = await matchesQuery

      if (matchesError) throw matchesError

      // Calculate leaderboard stats
      const leaderboardData = players.map(player => {
        const playerMatches = matches.filter(match => 
          match.player_match_stats.some(stat => stat.player_id === player.id)
        )

        const wins = playerMatches.filter(match => {
          const playerStat = match.player_match_stats.find(s => s.player_id === player.id)
          if (!playerStat) return false
          const wonMatch = (playerStat.team === 'radiant' && match.radiant_win) ||
                          (playerStat.team === 'dire' && !match.radiant_win)
          return wonMatch
        }).length

        const losses = playerMatches.length - wins
        const games = playerMatches.length
        const winRate = games > 0 ? ((wins / games) * 100).toFixed(1) : 0

        // Calculate performance metrics
        const playerStats = playerMatches.flatMap(match => 
          match.player_match_stats.filter(s => s.player_id === player.id)
        )

        const avgKills = playerStats.length > 0
          ? (playerStats.reduce((sum, s) => sum + s.kills, 0) / playerStats.length).toFixed(1)
          : 0

        const avgDeaths = playerStats.length > 0
          ? (playerStats.reduce((sum, s) => sum + s.deaths, 0) / playerStats.length).toFixed(1)
          : 0

        const avgAssists = playerStats.length > 0
          ? (playerStats.reduce((sum, s) => sum + s.assists, 0) / playerStats.length).toFixed(1)
          : 0

        const kda = avgDeaths > 0 
          ? ((parseFloat(avgKills) + parseFloat(avgAssists)) / parseFloat(avgDeaths)).toFixed(2)
          : parseFloat(avgKills) + parseFloat(avgAssists)

        const avgPerformance = playerStats.length > 0
          ? (playerStats.reduce((sum, s) => sum + (s.performance_score || 0), 0) / playerStats.length).toFixed(1)
          : 0

        // Calculate impact score (KDA * win rate)
        const impact = (parseFloat(kda) * parseFloat(winRate)).toFixed(0)

        // Calculate streak (last 5 games)
        const recentMatches = playerMatches.slice(-5)
        const recentWins = recentMatches.filter(match => {
          const playerStat = match.player_match_stats.find(s => s.player_id === player.id)
          if (!playerStat) return false
          return (playerStat.team === 'radiant' && match.radiant_win) ||
                 (playerStat.team === 'dire' && !match.radiant_win)
        }).length
        
        const streak = recentWins

        // Form: win rate of last 10 games
        const last10 = playerMatches.slice(-10)
        const last10Wins = last10.filter(match => {
          const playerStat = match.player_match_stats.find(s => s.player_id === player.id)
          if (!playerStat) return false
          return (playerStat.team === 'radiant' && match.radiant_win) ||
                 (playerStat.team === 'dire' && !match.radiant_win)
        }).length
        const form = last10.length > 0 ? `${last10Wins}/${last10.length}` : '0/0'

        // Calculate MMR (mock calculation based on performance)
        const baseMmr = 2000
        const mmr = baseMmr + (wins * 25) - (losses * 25) + parseInt(impact)

        return {
          player_id: player.id,
          player: player.name,
          dota_rank: player.dota_rank || 'Unranked',
          inhouse_rank: 'TBD',
          mmr: mmr,
          wins: wins,
          losses: losses,
          games: games,
          win_rate: parseFloat(winRate),
          kda: parseFloat(kda),
          impact: parseInt(impact),
          avg_performance: parseFloat(avgPerformance),
          streak: streak,
          form: form,
        }
      })

      // Sort by MMR
      const sortedData = leaderboardData
        .sort((a, b) => b.mmr - a.mmr)
        .map((item, index) => ({ ...item, rank: index + 1 }))

      setData(sortedData)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: ({ row }) => (
        <div className="font-bold text-gray-900">
          #{row.getValue('rank')}
        </div>
      ),
    },
    {
      accessorKey: 'player',
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1 hover:text-blue-600"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Player</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="font-medium text-blue-600">
          {row.getValue('player')}
        </div>
      ),
    },
    {
      accessorKey: 'dota_rank',
      header: 'Dota Rank',
    },
    {
      accessorKey: 'inhouse_rank',
      header: 'Inhouse Rank',
    },
    {
      accessorKey: 'mmr',
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1 hover:text-blue-600"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>MMR</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="font-semibold">
          {row.getValue('mmr').toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: 'wins',
      header: 'Wins',
      cell: ({ row }) => (
        <div className="text-green-600 font-medium">
          {row.getValue('wins')}
        </div>
      ),
    },
    {
      accessorKey: 'losses',
      header: 'Losses',
      cell: ({ row }) => (
        <div className="text-red-600 font-medium">
          {row.getValue('losses')}
        </div>
      ),
    },
    {
      accessorKey: 'games',
      header: 'Games',
    },
    {
      accessorKey: 'win_rate',
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1 hover:text-blue-600"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Win %</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      ),
      cell: ({ row }) => (
        <div className={row.getValue('win_rate') >= 50 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
          {row.getValue('win_rate')}%
        </div>
      ),
    },
    {
      accessorKey: 'kda',
      header: 'KDA',
      cell: ({ row }) => (
        <div className={row.getValue('kda') >= 2 ? 'text-green-600 font-medium' : 'text-gray-700'}>
          {row.getValue('kda')}
        </div>
      ),
    },
    {
      accessorKey: 'impact',
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1 hover:text-blue-600"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Impact</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('impact')}
        </div>
      ),
    },
    {
      accessorKey: 'avg_performance',
      header: 'Avg Perf',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('avg_performance')}
        </div>
      ),
    },
    {
      accessorKey: 'streak',
      header: 'Streak',
      cell: ({ row }) => {
        const streak = row.getValue('streak')
        return (
          <div className="flex items-center space-x-1">
            {streak >= 3 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : streak <= 2 ? (
              <TrendingDown className="w-4 h-4 text-red-600" />
            ) : null}
            <span>{streak}/5</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'form',
      header: 'Form',
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
        <p className="text-gray-600 mt-1">Top performing players in the inhouse league</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search players..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Players</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{data.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Games</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {data.length > 0 ? (data.reduce((sum, p) => sum + p.games, 0) / data.length).toFixed(0) : 0}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Win Rate</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {data.length > 0 ? (data.reduce((sum, p) => sum + p.win_rate, 0) / data.length).toFixed(1) : 0}%
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg KDA</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {data.length > 0 ? (data.reduce((sum, p) => sum + p.kda, 0) / data.length).toFixed(2) : 0}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading leaderboard...
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No players found. Upload match data to get started!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-200">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
