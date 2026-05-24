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
    setMessage('Parsing replay file... This may take 30-60 seconds.')
    setMessageType('info')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-replay', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setMessage(result.message || 'Replay processed successfully!')
      setMessageType('success')
      setFile(null)
      e.target.reset()
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
              <CardTitle>Dota 2 Replay Upload - Coming Soon</CardTitle>
              <CardDescription>
                Native .dem parsing requires complex dependencies. Use these alternatives for now:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Film className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recommended: Use OpenDota</strong>
                    <div className="mt-2 space-y-2 text-sm">
                      <p>1. Upload your replay to <a href="https://www.opendota.com/request" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenDota.com/request</a></p>
                      <p>2. Wait 2-5 minutes for parsing</p>
                      <p>3. Download match data from their API</p>
                      <p>4. Format as CSV and upload here</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alternative: Manual Conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <p><strong>Option 1: OpenDota Parser</strong></p>
                <p>Upload to <a href="https://www.opendota.com/request" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenDota</a> and export the data</p>
                
                <p className="mt-4"><strong>Option 2: Stratz</strong></p>
                <p>Use <a href="https://stratz.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Stratz.com</a> to analyze your replays</p>

                <p className="mt-4"><strong>Option 3: Match ID</strong></p>
                <p>If you have the Match ID from the .dem filename (e.g., <code className="bg-gray-100 px-1 rounded">8823519575.dem</code>), you can look it up on OpenDota or Dotabuff and export the stats.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Uploaded File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Match ID: 8823519575</p>
                <p className="text-sm text-gray-600">File Size: 65.3 MB</p>
                <div className="mt-4">
                  <a 
                    href="https://www.opendota.com/matches/8823519575" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View on OpenDota →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Why CSV Upload is Better (For Now)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div><strong>Full Control:</strong> Choose exactly which stats to include</div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div><strong>Batch Upload:</strong> Upload multiple matches at once</div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div><strong>Reliable:</strong> Works every time with no parsing errors</div>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div><strong>Fast:</strong> No waiting for parsing, instant upload</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
