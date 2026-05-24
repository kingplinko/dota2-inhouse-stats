'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Film, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'

export default function ReplayUploadPage() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('info')
  const supabase = createClient()

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) {
      setMessage('Please select a .dem file')
      setMessageType('error')
      return
    }

    setUploading(true)
    setUploadStatus('uploading')
    setMessage('Uploading replay file to storage...')
    setMessageType('info')

    try {
      // 1. Upload file to Supabase Storage
      const filePath = `${Date.now()}_${file.name}`
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('replays')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      setUploadStatus('uploaded')
      setMessage('File uploaded! Creating database entry...')

      // 2. Create replay_uploads entry
      const { data: uploadRecord, error: dbError } = await supabase
        .from('replay_uploads')
        .insert({
          file_name: file.name,
          file_path: filePath,
          status: 'uploaded',
          match_id: file.name.replace('.dem', '')
        })
        .select()
        .single()

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }

      setMessage('Triggering parse process...')
      setUploadStatus('parsing')

      // 3. Trigger parsing
      const parseResponse = await fetch('/api/parse-replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: uploadRecord.id,
          filePath: filePath
        })
      })

      const parseResult = await parseResponse.json()

      if (parseResult.success) {
        setUploadStatus('complete')
        setMessage(`✅ ${parseResult.message} Check the leaderboard!`)
        setMessageType('success')
      } else {
        setUploadStatus('failed')
        setMessage(parseResult.message || parseResult.error)
        setMessageType('error')
      }

      setFile(null)
      e.target.reset()

    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('failed')
      setMessage(`Error: ${error.message}`)
      setMessageType('error')
    } finally {
      setUploading(false)
    }
  }

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
      case 'uploaded':
      case 'parsing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading to storage...'
      case 'uploaded':
        return 'Uploaded! Creating record...'
      case 'parsing':
        return 'Parsing replay data...'
      case 'complete':
        return 'Complete! Match imported.'
      case 'failed':
        return 'Failed - see error message'
      default:
        return 'Ready to upload'
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Replay Upload</h1>
        <p className="text-gray-600 mt-1">Upload .dem files for automatic parsing</p>
      </div>

      {message && (
        <Alert variant={messageType === 'error' ? 'destructive' : 'default'}>
          {getStatusIcon()}
          <AlertDescription className="ml-2">{message}</AlertDescription>
        </Alert>
      )}

      {uploadStatus && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <div className="font-semibold">Status: {uploadStatus.toUpperCase()}</div>
                <div className="text-sm text-gray-600">{getStatusText()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload Dota 2 Replay (.dem)</CardTitle>
          <CardDescription>
            Select a .dem replay file and we'll upload it to storage and parse it automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                type="file"
                accept=".dem"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              <Button type="submit" disabled={!file || uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Film className="mr-2 h-4 w-4" />
                    Upload Replay
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-2">
              <Upload className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Step 1: Upload</strong> - File is uploaded to Supabase Storage
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Step 2: Record</strong> - Upload entry created in database with status tracking
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Loader2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Step 3: Parse</strong> - Backend API processes the replay file
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Step 4: Import</strong> - Match data and player stats added to leaderboard
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>✅ <strong>File format:</strong> .dem (Dota 2 replay file)</p>
            <p>✅ <strong>Match type:</strong> Public matches (ranked/unranked) work best</p>
            <p>✅ <strong>File naming:</strong> Should be named with match ID (e.g., 8823519575.dem)</p>
            <p>⚠️ <strong>Private lobbies:</strong> May not be available via Steam API - use CSV upload instead</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
