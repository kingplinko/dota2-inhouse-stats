'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SynergyPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSynergyData()
  }, [])

  async function loadSynergyData() {
    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          id,
          radiant_win,
          player_match_stats(
            hero,
            team
          )
        `)

      if (error) throw error

      const synergies = {}

      matches.forEach(match => {
        const radiantHeroes = match.player_match_stats
          .filter(s => s.team === 'radiant')
          .map(s => s.hero)
          .sort()

        const direHeroes = match.player_match_stats
          .filter(s => s.team === 'dire')
          .map(s => s.hero)
          .sort()

        // Count radiant hero pairs
        if (match.radiant_win) {
          for (let i = 0; i < radiantHeroes.length; i++) {
            for (let j = i + 1; j < radiantHeroes.length; j++) {
              const pair = `${radiantHeroes[i]} + ${radiantHeroes[j]}`
              if (!synergies[pair]) {
                synergies[pair] = { pair, games: 0, wins: 0 }
              }
              synergies[pair].games++
              synergies[pair].wins++
            }
          }
        }

        // Count dire hero pairs
        if (!match.radiant_win) {
          for (let i = 0; i < direHeroes.length; i++) {
            for (let j = i + 1; j < direHeroes.length; j++) {
              const pair = `${direHeroes[i]} + ${direHeroes[j]}`
              if (!synergies[pair]) {
                synergies[pair] = { pair, games: 0, wins: 0 }
              }
              synergies[pair].games++
              synergies[pair].wins++
            }
          }
        }
      })

      const synergyData = Object.values(synergies)
        .map(syn => ({
          ...syn,
          winRate: ((syn.wins / syn.games) * 100).toFixed(1),
        }))
        .filter(syn => syn.games >= 2)
        .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
        .slice(0, 50)

      setData(synergyData)
    } catch (error) {
      console.error('Error loading synergy data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hero Synergy</h1>
        <p className="text-gray-600 mt-1">Best hero combinations based on win rates</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading synergy data...</div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center text-gray-500">Not enough data to calculate synergies</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Top Hero Combinations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hero Pair</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Games</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wins</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((syn, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">#{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{syn.pair}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{syn.games}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">{syn.wins}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            parseFloat(syn.winRate) >= 60
                              ? 'text-green-600'
                              : parseFloat(syn.winRate) >= 50
                              ? 'text-blue-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {syn.winRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
