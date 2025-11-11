import { NextRequest, NextResponse } from 'next/server'
import { TwitchClient } from '@/lib/twitch'
import { signToken } from '@/lib/auth'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  try {
    const stateData = state ? JSON.parse(Buffer.from(state, 'base64').toString()) : { type: 'viewer' }

    const clientId = process.env.TWITCH_CLIENT_ID!
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitch/callback`

    const client = new TwitchClient(clientId, clientSecret)
    const tokenResponse = await client.exchangeCode(code, redirectUri)

    // Set access token and get user info
    client.setAccessToken(tokenResponse.access_token)
    const twitchUser = await client.getUser()

    // Store or update user in database
    const user = await prisma.user.upsert({
      where: { twitchUserId: twitchUser.id },
      update: {
        login: twitchUser.login,
        displayName: twitchUser.display_name,
        profileImageUrl: twitchUser.profile_image_url,
        updatedAt: new Date(),
      },
      create: {
        twitchUserId: twitchUser.id,
        login: twitchUser.login,
        displayName: twitchUser.display_name,
        profileImageUrl: twitchUser.profile_image_url,
      },
    })

    // Generate JWT
    const token = signToken(twitchUser)

    // Redirect to dashboard with token
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
