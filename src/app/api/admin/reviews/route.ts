import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/db'

function isAdmin(twitchUserId: string): boolean {
  return twitchUserId === process.env.TWITCH_BROADCASTER_ID
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload || !isAdmin(payload.twitchUserId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'

    const alerts = await prisma.alert.findMany({
      where: { status },
      include: {
        user: true,
        reviews: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: alerts,
    })
  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Failed to get reviews' }, { status: 500 })
  }
}
