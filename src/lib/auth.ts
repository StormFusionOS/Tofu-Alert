import jwt from 'jsonwebtoken'
import { TwitchUser } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface JWTPayload {
  userId: string
  twitchUserId: string
  login: string
  iat?: number
  exp?: number
}

export function signToken(user: TwitchUser): string {
  const payload: JWTPayload = {
    userId: user.id,
    twitchUserId: user.id,
    login: user.login,
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch (error) {
    return null
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}
