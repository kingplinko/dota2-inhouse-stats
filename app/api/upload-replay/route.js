import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Check file extension
    if (!file.name.endsWith('.dem')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .dem file' },
        { status: 400 }
      )
    }

    // For now, we'll provide guidance to use OpenDota or other parsers
    // Full native parsing requires complex dependencies that aren't stable in Next.js yet
    
    return NextResponse.json({
      success: false,
      message: 'Demo file parsing is currently in development.',
      alternativeMethod: {
        step1: 'Upload your replay to OpenDota: https://www.opendota.com/request',
        step2: 'Wait for parsing (usually 2-5 minutes)',
        step3: 'Export the match data or use their API',
        step4: 'Format the data and upload via CSV to this dashboard',
      },
      fileInfo: {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        matchId: file.name.replace('.dem', ''),
      },
      tip: 'We recommend using CSV upload for now, which gives you full control over the data.',
    })

  } catch (error) {
    console.error('Replay upload error:', error)
    return NextResponse.json(
      { error: `Failed to process replay: ${error.message}` },
      { status: 500 }
    )
  }
}
