import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { EventSubMessage, ChatMessageEvent } from '@/lib/types'
import prisma from '@/lib/db'
import { getBotClient } from '@/lib/twitch'

const EVENTSUB_SECRET = process.env.EVENTSUB_SECRET || ''

function verifySignature(
  messageId: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const message = messageId + timestamp + body
  const hmac = crypto.createHmac('sha256', EVENTSUB_SECRET)
  hmac.update(message)
  const expectedSignature = 'sha256=' + hmac.digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const messageId = request.headers.get('Twitch-Eventsub-Message-Id') || ''
    const timestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp') || ''
    const signature = request.headers.get('Twitch-Eventsub-Message-Signature') || ''
    const messageType = request.headers.get('Twitch-Eventsub-Message-Type') || ''

    // Verify signature
    if (!verifySignature(messageId, timestamp, body, signature)) {
      console.error('Invalid EventSub signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const event: EventSubMessage = JSON.parse(body)

    // Handle challenge (webhook verification)
    if (messageType === 'webhook_callback_verification') {
      return new NextResponse(event.payload?.challenge || '', { status: 200 })
    }

    // Handle notification
    if (messageType === 'notification') {
      const subscriptionType = event.metadata.subscription_type

      if (subscriptionType === 'channel.chat.message') {
        await handleChatMessage(event.payload?.event as ChatMessageEvent)
      }

      return NextResponse.json({ success: true })
    }

    // Handle revocation
    if (messageType === 'revocation') {
      console.log('EventSub subscription revoked:', event)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('EventSub webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleChatMessage(event: ChatMessageEvent) {
  const messageText = event.message.text.trim()

  // Check for !myalert command
  if (!messageText.startsWith('!myalert')) {
    return
  }

  console.log(`[Chat] !myalert command from ${event.chatter_user_login}`)

  try {
    // Get settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    if (!settings) {
      console.error('Settings not found')
      return
    }

    // Check if alerts are muted
    if (settings.alertsMuted) {
      await sendChatReply(
        event.broadcaster_user_id,
        event.message_id,
        `@${event.chatter_user_login} Alerts are currently muted.`
      )
      return
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { twitchUserId: event.chatter_user_id },
      include: {
        subscription: true,
        alerts: {
          where: { status: 'approved' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!user) {
      await sendChatReply(
        event.broadcaster_user_id,
        event.message_id,
        `@${event.chatter_user_login} You need to sign in and upload an alert first! Visit ${process.env.NEXT_PUBLIC_APP_URL}`
      )
      return
    }

    // Check subscription
    if (!user.subscription || user.subscription.tier !== 3000 || !user.subscription.isActive) {
      await sendChatReply(
        event.broadcaster_user_id,
        event.message_id,
        `@${event.chatter_user_login} Tier 3 subscription required!`
      )
      return
    }

    // Check if user has approved alert
    if (user.alerts.length === 0) {
      await sendChatReply(
        event.broadcaster_user_id,
        event.message_id,
        `@${event.chatter_user_login} You don't have an approved alert. Upload one at ${process.env.NEXT_PUBLIC_APP_URL}`
      )
      return
    }

    const alert = user.alerts[0]

    // Check cooldown
    const cooldownMs = settings.cooldownHours * 60 * 60 * 1000
    const lastTrigger = await prisma.trigger.findFirst({
      where: { userId: user.id },
      orderBy: { triggeredAt: 'desc' },
    })

    if (lastTrigger) {
      const timeSinceLastTrigger = Date.now() - lastTrigger.triggeredAt.getTime()
      if (timeSinceLastTrigger < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastTrigger
        const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000))
        const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))

        await sendChatReply(
          event.broadcaster_user_id,
          event.message_id,
          `@${event.chatter_user_login} Cooldown active! Try again in ${remainingHours}h ${remainingMinutes}m`
        )
        return
      }
    }

    // Create trigger
    const trigger = await prisma.trigger.create({
      data: {
        userId: user.id,
        alertId: alert.id,
        chatMessageId: event.message_id,
      },
    })

    // Dispatch to overlay (via WebSocket - implement separately)
    // For now, we'll just log it
    console.log(`[Trigger] Alert ${alert.id} triggered by ${user.login}`)

    // Reply to chat
    await sendChatReply(
      event.broadcaster_user_id,
      event.message_id,
      `@${event.chatter_user_login} Playing your alert!`
    )
  } catch (error) {
    console.error('Error handling chat command:', error)
  }
}

async function sendChatReply(
  broadcasterId: string,
  replyToMessageId: string,
  message: string
): Promise<void> {
  try {
    const botClient = getBotClient()
    const botUserId = process.env.TWITCH_BOT_USER_ID!

    await botClient.sendChatMessage(broadcasterId, botUserId, message, replyToMessageId)
  } catch (error) {
    console.error('Error sending chat reply:', error)
  }
}

// Admin command handler for !alerts on|off
async function handleAdminCommands(event: ChatMessageEvent) {
  const messageText = event.message.text.trim()

  if (!messageText.startsWith('!alerts ')) {
    return
  }

  // Check if user is broadcaster or moderator
  const isBroadcaster = event.chatter_user_id === event.broadcaster_user_id
  const isModerator = event.badges?.some((badge) => badge.set_id === 'moderator')

  if (!isBroadcaster && !isModerator) {
    return
  }

  const command = messageText.split(' ')[1]?.toLowerCase()

  if (command === 'off') {
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { alertsMuted: true },
      create: { id: 1, alertsMuted: true },
    })

    await sendChatReply(
      event.broadcaster_user_id,
      event.message_id,
      'Alerts have been muted.'
    )
  } else if (command === 'on') {
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { alertsMuted: false },
      create: { id: 1, alertsMuted: false },
    })

    await sendChatReply(
      event.broadcaster_user_id,
      event.message_id,
      'Alerts have been unmuted.'
    )
  }
}
