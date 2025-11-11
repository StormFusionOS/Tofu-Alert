// Alert status types
export type AlertStatus = 'pending' | 'approved' | 'denied'

// Review stage types
export type ReviewStage = 'heuristic' | 'stt' | 'ocr' | 'llm' | 'manual'

// Review verdict types
export type ReviewVerdict = 'pass' | 'fail' | 'escalate'

// Twitch subscription tier types
export type SubscriptionTier = 1000 | 2000 | 3000

// Moderation policy types
export interface ModerationPolicy {
  version: number
  deny_on_uncertain: boolean
  categories: {
    [key: string]: {
      deny: boolean
      notes?: string
    }
  }
  confidence_threshold: number
  max_duration_sec: number
  blocklist?: {
    domains?: string[]
    phrases?: string[]
  }
  allowed_mime_types?: string[]
}

// LLM moderation response
export interface LLMModerationResponse {
  verdict: 'SAFE' | 'UNSAFE'
  confidence: number
  categories: string[]
  notes: string
}

// Twitch API types
export interface TwitchUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
}

export interface TwitchSubscription {
  broadcaster_id: string
  broadcaster_name: string
  is_gift: boolean
  tier: string // "1000" | "2000" | "3000"
}

export interface TwitchTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string[]
}

// EventSub types
export interface EventSubMessage {
  metadata: {
    message_id: string
    message_type: string
    message_timestamp: string
    subscription_type?: string
    subscription_version?: string
  }
  payload?: {
    subscription?: any
    event?: any
  }
}

export interface ChatMessageEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  chatter_user_id: string
  chatter_user_login: string
  chatter_user_name: string
  message_id: string
  message: {
    text: string
    fragments: any[]
  }
  color: string
  badges: any[]
  message_type: string
  cheer?: any
  reply?: any
}

// WebSocket overlay event
export interface OverlayEvent {
  type: 'trigger_alert'
  data: {
    alertId: string
    cdnUrl: string
    durationSec: number
    userId: string
    username: string
  }
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Upload types
export interface PresignedUploadResponse {
  uploadUrl: string
  alertId: string
  fields?: Record<string, string>
}

// Settings
export interface AppSettings {
  alertsMuted: boolean
  cooldownHours: number
  maxDurationSec: number
  maxFileSizeMB: number
}
