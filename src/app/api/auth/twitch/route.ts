import { NextRequest, NextResponse } from 'next/server'
import { generateAuthUrl } from '@/lib/twitch'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') || 'viewer'

  const clientId = process.env.TWITCH_CLIENT_ID!

  let redirectUri: string
  let scopes: string[]

  switch (type) {
    case 'broadcaster':
      redirectUri = process.env.TWITCH_BROADCASTER_REDIRECT_URI!
      scopes = ['channel:read:subscriptions', 'user:read:chat', 'user:write:chat', 'channel:bot']
      break

    case 'bot':
      redirectUri = process.env.TWITCH_BOT_REDIRECT_URI!
      scopes = ['user:read:chat', 'user:write:chat', 'user:bot']
      break

    case 'viewer':
    default:
      redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitch/callback`
      scopes = ['user:read:subscriptions', 'openid']
      break
  }

  const state = Buffer.from(JSON.stringify({ type, timestamp: Date.now() })).toString('base64')
  const authUrl = generateAuthUrl(clientId, redirectUri, scopes, state)

  return NextResponse.redirect(authUrl)
}
