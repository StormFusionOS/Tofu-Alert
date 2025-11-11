import { NextRequest, NextResponse } from 'next/server'
import { broadcastToOverlay } from '@/lib/websocket'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { alertId, cdnUrl, durationSec, userId, username } = body

    if (!alertId || !cdnUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Broadcast to all connected overlay clients
    broadcastToOverlay({
      type: 'trigger_alert',
      data: {
        alertId,
        cdnUrl,
        durationSec,
        userId,
        username,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Alert dispatched to overlay',
    })
  } catch (error) {
    console.error('Overlay trigger error:', error)
    return NextResponse.json({ error: 'Failed to trigger overlay' }, { status: 500 })
  }
}
