import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/db'

function isAdmin(twitchUserId: string): boolean {
  return twitchUserId === process.env.TWITCH_BROADCASTER_ID
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload || !isAdmin(payload.twitchUserId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json({ error: 'Reason required' }, { status: 400 })
    }

    const alert = await prisma.alert.update({
      where: { id: params.id },
      data: {
        status: 'denied',
        denialReason: reason,
        reviewedAt: new Date(),
      },
    })

    // Create manual review record
    await prisma.review.create({
      data: {
        alertId: alert.id,
        stage: 'manual',
        verdict: 'fail',
        details: JSON.stringify({
          deniedBy: payload.twitchUserId,
          deniedAt: new Date(),
          reason,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: alert,
    })
  } catch (error) {
    console.error('Deny alert error:', error)
    return NextResponse.json({ error: 'Failed to deny alert' }, { status: 500 })
  }
}
