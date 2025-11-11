import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { generatePresignedUploadUrl } from '@/lib/storage'
import { getBroadcasterClient } from '@/lib/twitch'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { filename, mimeType } = body

    if (!filename || !mimeType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user is Tier 3 subscriber
    const broadcasterId = process.env.TWITCH_BROADCASTER_ID!
    const broadcasterClient = getBroadcasterClient()

    const subscription = await broadcasterClient.checkUserSubscription(
      broadcasterId,
      payload.twitchUserId
    )

    if (!subscription || subscription.tier !== '3000') {
      return NextResponse.json({ error: 'Tier 3 subscription required' }, { status: 403 })
    }

    // Update or create subscription snapshot
    const user = await prisma.user.findUnique({
      where: { twitchUserId: payload.twitchUserId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.subscriptionSnapshot.upsert({
      where: { userId: user.id },
      update: {
        tier: parseInt(subscription.tier),
        isGift: subscription.is_gift,
        isActive: true,
        checkedAt: new Date(),
      },
      create: {
        userId: user.id,
        tier: parseInt(subscription.tier),
        isGift: subscription.is_gift,
        isActive: true,
      },
    })

    // Check if user already has a pending or approved alert
    const existingAlert = await prisma.alert.findFirst({
      where: {
        userId: user.id,
        status: { in: ['pending', 'approved'] },
      },
    })

    if (existingAlert) {
      return NextResponse.json(
        {
          error: 'You already have an alert. Please delete or wait for review of your current alert.',
        },
        { status: 400 }
      )
    }

    // Generate presigned upload URL
    const { url: uploadUrl, key } = await generatePresignedUploadUrl(filename, {
      folder: 'uploads',
      contentType: mimeType,
    })

    // Create alert record
    const alert = await prisma.alert.create({
      data: {
        userId: user.id,
        status: 'pending',
        srcUrl: `${process.env.CDN_BASE_URL}/${key}`,
        mimeType,
        durationSec: 0, // Will be updated during moderation
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        alertId: alert.id,
        uploadUrl,
      },
    })
  } catch (error) {
    console.error('Create alert error:', error)
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { twitchUserId: payload.twitchUserId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const alerts = await prisma.alert.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        reviews: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: alerts,
    })
  } catch (error) {
    console.error('Get alerts error:', error)
    return NextResponse.json({ error: 'Failed to get alerts' }, { status: 500 })
  }
}
