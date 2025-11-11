import axios, { AxiosInstance } from 'axios'
import { TwitchUser, TwitchSubscription, TwitchTokenResponse } from './types'

const TWITCH_API_BASE = 'https://api.twitch.tv/helix'
const TWITCH_OAUTH_BASE = 'https://id.twitch.tv/oauth2'

export class TwitchClient {
  private client: AxiosInstance
  private clientId: string
  private clientSecret: string

  constructor(clientId: string, clientSecret: string, accessToken?: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret

    this.client = axios.create({
      baseURL: TWITCH_API_BASE,
      headers: {
        'Client-ID': clientId,
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
    })
  }

  setAccessToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  // OAuth methods
  async exchangeCode(code: string, redirectUri: string): Promise<TwitchTokenResponse> {
    const response = await axios.post(`${TWITCH_OAUTH_BASE}/token`, null, {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
    })
    return response.data
  }

  async refreshToken(refreshToken: string): Promise<TwitchTokenResponse> {
    const response = await axios.post(`${TWITCH_OAUTH_BASE}/token`, null, {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
    })
    return response.data
  }

  async validateToken(accessToken: string): Promise<any> {
    const response = await axios.get(`${TWITCH_OAUTH_BASE}/validate`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return response.data
  }

  // User methods
  async getUser(userId?: string): Promise<TwitchUser> {
    const params = userId ? { id: userId } : {}
    const response = await this.client.get('/users', { params })
    return response.data.data[0]
  }

  async getUserByLogin(login: string): Promise<TwitchUser> {
    const response = await this.client.get('/users', {
      params: { login },
    })
    return response.data.data[0]
  }

  // Subscription methods
  async checkUserSubscription(
    broadcasterId: string,
    userId: string
  ): Promise<TwitchSubscription | null> {
    try {
      const response = await this.client.get('/subscriptions/user', {
        params: {
          broadcaster_id: broadcasterId,
          user_id: userId,
        },
      })
      return response.data.data[0] || null
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }

  async getBroadcasterSubscriptions(
    broadcasterId: string,
    userId?: string
  ): Promise<TwitchSubscription[]> {
    const params: any = { broadcaster_id: broadcasterId }
    if (userId) {
      params.user_id = userId
    }

    const response = await this.client.get('/subscriptions', { params })
    return response.data.data
  }

  // Chat methods
  async sendChatMessage(
    broadcasterId: string,
    senderId: string,
    message: string,
    replyParentMessageId?: string
  ): Promise<any> {
    const body: any = {
      broadcaster_id: broadcasterId,
      sender_id: senderId,
      message,
    }

    if (replyParentMessageId) {
      body.reply_parent_message_id = replyParentMessageId
    }

    const response = await this.client.post('/chat/messages', body)
    return response.data
  }

  // EventSub methods
  async createEventSubSubscription(
    type: string,
    version: string,
    condition: any,
    transport: any
  ): Promise<any> {
    const response = await this.client.post('/eventsub/subscriptions', {
      type,
      version,
      condition,
      transport,
    })
    return response.data
  }

  async getEventSubSubscriptions(): Promise<any> {
    const response = await this.client.get('/eventsub/subscriptions')
    return response.data
  }

  async deleteEventSubSubscription(id: string): Promise<void> {
    await this.client.delete(`/eventsub/subscriptions?id=${id}`)
  }
}

export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    ...(state && { state }),
  })

  return `${TWITCH_OAUTH_BASE}/authorize?${params.toString()}`
}

// Singleton instances for different token types
let broadcasterClient: TwitchClient | null = null
let botClient: TwitchClient | null = null

export function getBroadcasterClient(): TwitchClient {
  if (!broadcasterClient) {
    const clientId = process.env.TWITCH_CLIENT_ID!
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!
    const accessToken = process.env.TWITCH_BROADCASTER_ACCESS_TOKEN
    broadcasterClient = new TwitchClient(clientId, clientSecret, accessToken)
  }
  return broadcasterClient
}

export function getBotClient(): TwitchClient {
  if (!botClient) {
    const clientId = process.env.TWITCH_CLIENT_ID!
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!
    const accessToken = process.env.TWITCH_BOT_ACCESS_TOKEN
    botClient = new TwitchClient(clientId, clientSecret, accessToken)
  }
  return botClient
}

export function createViewerClient(accessToken: string): TwitchClient {
  const clientId = process.env.TWITCH_CLIENT_ID!
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!
  return new TwitchClient(clientId, clientSecret, accessToken)
}
