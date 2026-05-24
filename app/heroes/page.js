'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'

export default function HeroesPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadHeroStats()
  }, [])

  async function loadHeroStats() {
    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          radiant_win,
          player_match_stats(
            hero,
            team,
            kills,
            deaths,
            assists,
            gpm,
            xpm
          )
        `)

      if (error) throw error

      const heroStats = {}

      matches.forEach(match => {
        match.player_match_stats.forEach(stat => {
          if (!heroStats[stat.hero]) {
            heroStats[stat.hero] = {
              hero: stat.hero,
              games: 0,
              wins: 0,
              kills: 0,
              deaths: 0,
              assists: 0,
              gpm: 0,
              xpm: 0,
            }
          }

          heroStats[stat.hero].games++
          heroStats[stat.hero].kills += stat.kills
          heroStats[stat.hero].deaths += stat.deaths
          heroStats[stat.hero].assists += stat.assists
          heroStats[stat.hero].gpm += stat.gpm
          heroStats[stat.hero].xpm += stat.xpm

          const won = (stat.team === 'radiant' && match.radiant_win) ||
                     (stat.team === 'dire' && !match.radiant_win)
          if (won) heroStats[stat.hero].wins++
        })
      })

      const heroData = Object.values(heroStats).map(hero => ({
        ...hero,
        winRate: ((hero.wins / hero.games) * 100).toFixed(1),
        avgKills: (hero.kills / hero.games).toFixed(1),
        avgDeaths: (hero.deaths / hero.games).toFixed(1),
        avgAssists: (hero.assists / hero.games).toFixed(1),
        avgGpm: (hero.gpm / hero.games).toFixed(0),
        avgXpm: (hero.xpm / hero.games).toFixed(0),
        pickRate: ((hero.games / matches.length) * 100).toFixed(1),
      }))

      setData(heroData)
    } catch (error) {
      console.error('Error loading hero stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      accessorKey: 'hero',
      header: 'Hero',
      cell: ({ row }) => (
        <div className="font-medium text-gray-900">{row.getValue('hero')}</div>
      ),
    },
    {
      accessorKey: 'games',
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1 hover:text-blue-600"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Games</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      ),
    },
    {
      accessorKey: 'wins',
      header: 'Wins',
      cell: ({ row }) => (
        <div className="text-green-600 font-medium">{row.getValue('wins')}</div>
      ),
    },
    {
      accessorKey: 'winRate',
      header: ({ column }) => (
        <button
          className="flex items-center space-x-1 hover:text-blue-600"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <span>Win Rate</span>
          <ArrowUpDown className="w-4 h-4" />
        </button>
      ),
      cell: ({ row }) => {
        const winRate = parseFloat(row.getValue('winRate'))
        return (
          <div className={winRate >= 50 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {winRate}%
          </div>
        )
      },
    },
    {
      accessorKey: 'pickRate',
      header: 'Pick Rate',
      cell: ({ row }) => `${row.getValue('pickRate')}%`,
    },
    {
      accessorKey: 'avgKills',
      header: 'Avg K',
    },
    {
      accessorKey: 'avgDeaths',
      header: 'Avg D',
    },
    {
      accessorKey: 'avgAssists',
      header: 'Avg A',
    },
    {
      accessorKey: 'avgGpm',
      header: 'Avg GPM',
    },
    {
      accessorKey: 'avgXpm',
      header: 'Avg XPM',
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [{ id: 'games', desc: true }],
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Heroes</h1>
        <p className="text-gray-600 mt-1">Hero statistics and performance metrics</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Heroes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Most Picked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {data.length > 0 ? data.sort((a, b) => b.games - a.games)[0].hero : 'N/A'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Highest Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-600">
              {data.length > 0
                ? data.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))[0].hero
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Avg Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.length > 0
                ? (data.reduce((sum, h) => sum + parseFloat(h.winRate), 0) / data.length).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading hero statistics...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No hero data available yet</div>
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
