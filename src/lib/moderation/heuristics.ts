import { ModerationPolicy } from '../types'
import fs from 'fs/promises'
import path from 'path'

let policy: ModerationPolicy | null = null

export async function loadPolicy(): Promise<ModerationPolicy> {
  if (!policy) {
    const policyPath = path.join(process.cwd(), 'moderation', 'policy.json')
    const policyData = await fs.readFile(policyPath, 'utf-8')
    policy = JSON.parse(policyData)
  }
  return policy
}

export interface HeuristicResult {
  passed: boolean
  flags: string[]
  details: string[]
}

export async function runHeuristicChecks(
  filename: string,
  mimeType: string,
  durationSec: number,
  fileSizeMB: number,
  metadata?: Record<string, any>
): Promise<HeuristicResult> {
  const policy = await loadPolicy()
  const flags: string[] = []
  const details: string[] = []

  // Check MIME type
  if (policy.allowed_mime_types && !policy.allowed_mime_types.includes(mimeType)) {
    flags.push('invalid_mime_type')
    details.push(`MIME type ${mimeType} is not allowed`)
  }

  // Check duration
  if (durationSec > policy.max_duration_sec) {
    flags.push('duration_exceeded')
    details.push(`Duration ${durationSec}s exceeds max ${policy.max_duration_sec}s`)
  }

  // Check filename for suspicious patterns
  const filenameLower = filename.toLowerCase()
  const suspiciousPatterns = [
    /porn|sex|xxx|nude|nsfw/i,
    /\.(exe|bat|sh|cmd|com)$/i, // Executable extensions
    /hack|exploit|crack/i,
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filenameLower)) {
      flags.push('suspicious_filename')
      details.push(`Filename contains suspicious pattern: ${pattern}`)
    }
  }

  // Check for blocklisted domains/links
  if (policy.blocklist?.domains) {
    for (const domain of policy.blocklist.domains) {
      if (filenameLower.includes(domain)) {
        flags.push('blocklisted_domain')
        details.push(`Filename contains blocklisted domain: ${domain}`)
      }
    }
  }

  return {
    passed: flags.length === 0,
    flags,
    details,
  }
}

export async function checkTextContent(text: string): Promise<HeuristicResult> {
  const policy = await loadPolicy()
  const flags: string[] = []
  const details: string[] = []

  const textLower = text.toLowerCase()

  // Check blocklisted phrases
  if (policy.blocklist?.phrases) {
    for (const phrase of policy.blocklist.phrases) {
      const phraseLower = phrase.toLowerCase()
      if (textLower.includes(phraseLower)) {
        flags.push('blocklisted_phrase')
        details.push(`Text contains blocklisted phrase: ${phrase}`)
      }
    }
  }

  // Check for URLs/links
  const urlPattern = /(https?:\/\/[^\s]+)/gi
  const urls = text.match(urlPattern)
  if (urls) {
    flags.push('contains_urls')
    details.push(`Text contains URLs: ${urls.join(', ')}`)

    // Check if URLs contain blocklisted domains
    if (policy.blocklist?.domains) {
      for (const url of urls) {
        for (const domain of policy.blocklist.domains) {
          if (url.toLowerCase().includes(domain)) {
            flags.push('blocklisted_domain_url')
            details.push(`URL contains blocklisted domain: ${domain}`)
          }
        }
      }
    }
  }

  // Check for email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailPattern)
  if (emails) {
    flags.push('contains_email')
    details.push(`Text contains email addresses: ${emails.join(', ')}`)
  }

  // Check for phone numbers (simple pattern)
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
  const phones = text.match(phonePattern)
  if (phones) {
    flags.push('contains_phone')
    details.push(`Text contains phone numbers: ${phones.join(', ')}`)
  }

  // Check for excessive profanity
  const profanityPattern = /\b(fuck|shit|bitch|damn|ass|hell|crap)\b/gi
  const profanityMatches = text.match(profanityPattern)
  if (profanityMatches && profanityMatches.length > 3) {
    flags.push('excessive_profanity')
    details.push(`Text contains excessive profanity (${profanityMatches.length} instances)`)
  }

  // Check for targeted profanity (profanity followed by "you" or pronouns)
  const targetedProfanityPattern = /\b(fuck|shit|bitch)\s+(you|your|him|her|them)\b/gi
  if (targetedProfanityPattern.test(text)) {
    flags.push('targeted_profanity')
    details.push('Text contains targeted profanity')
  }

  return {
    passed: flags.length === 0,
    flags,
    details,
  }
}

export function calculateRiskScore(flags: string[]): number {
  const riskWeights: Record<string, number> = {
    invalid_mime_type: 10,
    duration_exceeded: 5,
    suspicious_filename: 3,
    blocklisted_domain: 10,
    blocklisted_phrase: 10,
    blocklisted_domain_url: 10,
    contains_urls: 2,
    contains_email: 5,
    contains_phone: 5,
    excessive_profanity: 4,
    targeted_profanity: 8,
  }

  return flags.reduce((score, flag) => score + (riskWeights[flag] || 1), 0)
}
