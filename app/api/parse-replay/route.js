import { NextResponse } from 'next/server'

/**
 * Parse Replay API Route
 * 
 * Triggers external parser service to parse .dem file
 * Parser service handles: download from Supabase, parse, insert to DB
 */
export async function POST(request) {
  try {
    const { replay_upload_id } = await request.json()

    if (!replay_upload_id) {
      return NextResponse.json({
        success: false,
        error: 'replay_upload_id is required'
      }, { status: 400 })
    }

    console.log('[Parse Replay] Starting workflow for upload:', replay_upload_id)

    // Check if parser service is configured
    const parserUrl = process.env.PARSER_SERVICE_URL
    
    if (!parserUrl) {
      console.log('[Parse Replay] Parser service not configured')
      return NextResponse.json({
        success: true,
        status: 'parser_pending',
        message: 'Replay uploaded successfully, but stats have not been extracted yet because the parser service is not connected.'
      })
    }

    // Call Railway parser service
    console.log('[Parse Replay] Calling parser service:', parserUrl)
    
    const response = await fetch(`${parserUrl}/parse-replay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        replay_upload_id
      }),
      signal: AbortSignal.timeout(300000) // 5 minute timeout
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[Parse Replay] Parser service error:', result)
      return NextResponse.json({
        success: false,
        error: result.error || 'Parser service failed',
        details: result.details
      }, { status: response.status })
    }

    console.log('[Parse Replay] Parse successful!')
    return NextResponse.json({
      success: true,
      message: 'Replay parsed successfully! Check the leaderboard.',
      data: result
    })

  } catch (error) {
    console.error('[Parse Replay] Error:', error)
    
    if (error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        error: 'Parser service timeout - file may be too large or service is slow'
      }, { status: 504 })
    }
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
