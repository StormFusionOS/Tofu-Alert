import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { userId, messageId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Get settings
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
    })

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 500 })
    }

    // Check if alerts are muted
    if (settings.alertsMuted) {
      return NextResponse.json(
        {
          success: false,
          message: 'Alerts are currently muted',
        },
        { status: 403 }
      )
    }

    // Get alert
    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    if (alert.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          message: 'Alert is not approved',
        },
        { status: 403 }
      )
    }

    if (alert.user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check cooldown
    const cooldownMs = settings.cooldownHours * 60 * 60 * 1000
    const lastTrigger = await prisma.trigger.findFirst({
      where: { userId },
      orderBy: { triggeredAt: 'desc' },
    })

    if (lastTrigger) {
      const timeSinceLastTrigger = Date.now() - lastTrigger.triggeredAt.getTime()
      if (timeSinceLastTrigger < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastTrigger
        const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000))
        const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))

        return NextResponse.json(
          {
            success: false,
            message: `Cooldown active. Try again in ${remainingHours}h ${remainingMinutes}m`,
            remainingMs,
          },
          { status: 429 }
        )
      }
    }

    // Create trigger
    const trigger = await prisma.trigger.create({
      data: {
        userId,
        alertId: alert.id,
        chatMessageId: messageId,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        triggerId: trigger.id,
        cdnUrl: alert.cdnUrl,
        durationSec: alert.durationSec,
      },
    })
  } catch (error) {
    console.error('Trigger alert error:', error)
    return NextResponse.json({ error: 'Failed to trigger alert' }, { status: 500 })
  }
}
