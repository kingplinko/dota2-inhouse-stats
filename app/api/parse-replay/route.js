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

    console.log('[Parse Replay] ========================================')
    console.log('[Parse Replay] Starting workflow for upload:', replay_upload_id)

    // Check if parser service is configured
    const parserUrl = process.env.PARSER_SERVICE_URL
    
    console.log('[Parse Replay] PARSER_SERVICE_URL:', parserUrl)
    console.log('[Parse Replay] Is URL defined?', !!parserUrl)
    console.log('[Parse Replay] URL type:', typeof parserUrl)
    
    if (!parserUrl) {
      console.log('[Parse Replay] ❌ Parser service not configured - URL is missing')
      return NextResponse.json({
        success: true,
        status: 'parser_pending',
        message: 'Replay uploaded successfully, but stats have not been extracted yet because the parser service is not connected.'
      })
    }

    // Call Railway parser service
    const fullUrl = `${parserUrl}/parse-replay`
    console.log('[Parse Replay] ✅ Parser URL found!')
    console.log('[Parse Replay] Full endpoint URL:', fullUrl)
    console.log('[Parse Replay] Calling parser service...')
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        replay_upload_id
      }),
      signal: AbortSignal.timeout(300000) // 5 minute timeout
    })

    console.log('[Parse Replay] Parser response status:', response.status)
    console.log('[Parse Replay] Parser response ok?', response.ok)
    
    const result = await response.json()
    console.log('[Parse Replay] Parser response body:', JSON.stringify(result, null, 2))

    if (!response.ok) {
      console.error('[Parse Replay] ❌ Parser service error:', result)
      return NextResponse.json({
        success: false,
        error: result.error || 'Parser service failed',
        details: result.details
      }, { status: response.status })
    }

    console.log('[Parse Replay] ✅ Parse successful!')
    console.log('[Parse Replay] Match ID:', result.match_id)
    console.log('[Parse Replay] Players inserted:', result.players_inserted)
    console.log('[Parse Replay] Stats inserted:', result.stats_inserted)
    console.log('[Parse Replay] ========================================')
    
    return NextResponse.json({
      success: true,
      message: 'Replay parsed successfully! Check the leaderboard.',
      data: result
    })

  } catch (error) {
    console.error('[Parse Replay] ❌ Fatal error:', error)
    console.error('[Parse Replay] Error name:', error.name)
    console.error('[Parse Replay] Error message:', error.message)
    console.error('[Parse Replay] Error stack:', error.stack)
    
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
