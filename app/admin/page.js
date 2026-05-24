'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, CheckCircle, XCircle, Film } from 'lucide-react'
import Papa from 'papaparse'

export default function AdminPage() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('info')
  const [uploadType, setUploadType] = useState('csv')
  const supabase = createClient()

  async function handleCSVUpload(e) {
    e.preventDefault()
    if (!file) {
      setMessage('Please select a file')
      setMessageType('error')
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const text = await file.text()
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
      })

      if (parsed.errors.length > 0) {
        throw new Error(`CSV parsing error: ${parsed.errors[0].message}`)
      }

      const rows = parsed.data
      if (rows.length === 0) {
        throw new Error('No data found in CSV')
      }

      // Get or create season
      const { data: seasons } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single()

      if (!seasons) {
        throw new Error('No active season found')
      }

      let insertedCount = 0

      // Process each row
      for (const row of rows) {
        // Create/get player
        const playerName = row.player || row.player_name
        if (!playerName) continue

        let { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('name', playerName)
          .single()

        if (!player) {
          const { data: newPlayer } = await supabase
            .from('players')
            .insert({ name: playerName, dota_rank: row.dota_rank || 'Unranked' })
            .select()
            .single()
          player = newPlayer
        }

        // Create match
        const { data: match } = await supabase
          .from('matches')
          .insert({
            season_id: seasons.id,
            radiant_win: row.team === 'radiant' ? row.win === 'true' || row.win === '1' : row.win === 'false' || row.win === '0',
            match_date: row.match_date || new Date().toISOString(),
          })
          .select()
          .single()

        if (!match) continue

        // Insert player stats
        await supabase
          .from('player_match_stats')
          .insert({
            match_id: match.id,
            player_id: player.id,
            hero: row.hero || 'Unknown',
            position: parseInt(row.position) || 1,
            team: row.team || 'radiant',
            kills: parseInt(row.kills) || 0,
            deaths: parseInt(row.deaths) || 0,
            assists: parseInt(row.assists) || 0,
            last_hits: parseInt(row.last_hits) || 0,
            denies: parseInt(row.denies) || 0,
            gpm: parseInt(row.gpm) || 0,
            xpm: parseInt(row.xpm) || 0,
            hero_damage: parseInt(row.hero_damage) || 0,
            tower_damage: parseInt(row.tower_damage) || 0,
            hero_healing: parseInt(row.hero_healing) || 0,
            performance_score: parseFloat(row.performance_score) || 0,
          })

        insertedCount++
      }

      // Log upload
      await supabase
        .from('uploads')
        .insert({
          file_name: file.name,
          row_count: insertedCount,
          status: 'completed',
        })

      setMessage(`Successfully uploaded ${insertedCount} matches!`)
      setMessageType('success')
      setFile(null)
      e.target.reset()
    } catch (error) {
      console.error('Upload error:', error)
      setMessage(`Error: ${error.message}`)
      setMessageType('error')
    } finally {
      setUploading(false)
    }
  }

  async function handleReplayUpload(e) {
    e.preventDefault()
    if (!file) {
      setMessage('Please select a replay file')
      setMessageType('error')
      return
    }

    setUploading(true)
    setMessage('📤 Uploading and checking match type...')
    setMessageType('info')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-replay', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setMessage(result.message || '🎉 Match imported successfully! Check the leaderboard!')
        setMessageType('success')
        setFile(null)
        e.target.reset()
      } else if (result.matchType === 'private_lobby') {
        // It's an inhouse match - guide to CSV upload
        setMessage(
          <div className="space-y-3">
            <p className="font-semibold">✅ Private/Inhouse Match Detected!</p>
            <p className="text-sm">Match ID: {result.matchId}</p>
            <p className="text-sm">{result.message}</p>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
              <p className="font-semibold text-sm mb-2">📋 Solution: Use CSV Upload</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {result.solution.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="flex space-x-2 mt-3">
              <button
                onClick={() => {
                  const csvTab = document.querySelector('[value="csv"]')
                  if (csvTab) csvTab.click()
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go to CSV Upload →
              </button>
              <a 
                href={result.csvTemplate}
                download
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Download CSV Template
              </a>
            </div>
          </div>
        )
        setMessageType('info')
      } else {
        throw new Error(result.error || 'Upload failed')
      }
      
    } catch (error) {
      console.error('Replay upload error:', error)
      setMessage(`Error: ${error.message}`)
      setMessageType('error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Upload</h1>
        <p className="text-gray-600 mt-1">Upload match data via CSV or replay files</p>
      </div>

      {/* Parser Service Warning Banner */}
      <Alert className="bg-yellow-50 border-yellow-300 border-2">
        <div className="flex items-start space-x-3">
          <div className="text-yellow-600 text-2xl">⚠️</div>
          <div className="flex-1">
            <div className="font-semibold text-yellow-900">Parser Service Required for .dem Files</div>
            <div className="text-sm text-yellow-800 mt-1">
              .dem replay parsing requires an external parser microservice to extract match statistics. 
              Until connected, <strong>CSV upload is the working method</strong> to populate leaderboard data.
            </div>
            <div className="mt-2 flex space-x-4">
              <a href="/replays" className="text-sm text-blue-600 hover:underline font-medium">
                → View Replay Upload Status
              </a>
            </div>
          </div>
        </div>
      </Alert>

      {message && (
        <Alert variant={messageType === 'error' ? 'destructive' : 'default'}>
          {messageType === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : messageType === 'error' ? (
            <XCircle className="h-4 w-4" />
          ) : null}
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="csv" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="csv" onClick={() => { setUploadType('csv'); setFile(null); setMessage(null) }}>
            <FileText className="mr-2 h-4 w-4" />
            CSV Upload
          </TabsTrigger>
          <TabsTrigger value="replay" onClick={() => { setUploadType('replay'); setFile(null); setMessage(null) }}>
            <Film className="mr-2 h-4 w-4" />
            Replay (.dem)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload a CSV file with match data. The file should include player stats for each match.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCSVUpload} className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                  />
                  <Button type="submit" disabled={!file || uploading}>
                    {uploading ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>CSV Format</span>
              </CardTitle>
              <CardDescription>Your CSV file should have the following columns:</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                <div className="text-gray-700">
                  player, hero, team, kills, deaths, assists, last_hits, denies, gpm, xpm,
                  hero_damage, tower_damage, hero_healing, performance_score, position,
                  dota_rank, match_date, win
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600 space-y-2">
                <p><strong>player:</strong> Player name</p>
                <p><strong>hero:</strong> Hero name</p>
                <p><strong>team:</strong> radiant or dire</p>
                <p><strong>kills, deaths, assists:</strong> Player statistics</p>
                <p><strong>win:</strong> true/false or 1/0</p>
                <p><strong>performance_score:</strong> Overall performance rating (0-10)</p>
                <p><strong>position:</strong> 1-5 (carry to support)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <pre>
player,hero,team,kills,deaths,assists,last_hits,denies,gpm,xpm,hero_damage,tower_damage,hero_healing,performance_score,position,dota_rank,match_date,win
Player1,Anti-Mage,radiant,10,2,5,450,20,650,700,15000,3000,0,8.5,1,Divine 5,2024-01-15,true
Player2,Crystal Maiden,radiant,2,8,15,50,5,250,300,8000,500,5000,7.2,5,Ancient 3,2024-01-15,true
                  </pre>
                </div>
                <div>
                  <a
                    href="/sample_matches.csv"
                    download
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Download Sample CSV
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replay" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Replay Upload Moved</CardTitle>
              <CardDescription>
                For .dem replay file uploads, please use the dedicated Replays page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  The replay upload system has been moved to its own dedicated page with enhanced tracking and status monitoring.
                </p>
                <a
                  href="/replays"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Film className="mr-2 h-5 w-5" />
                  Go to Replay Upload Page →
                </a>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">💡 Note:</p>
                  <p className="text-sm text-gray-600">
                    Replay parsing requires an external parser microservice. Until it's connected, 
                    continue using CSV upload (this tab) to populate match data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
