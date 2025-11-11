import { LLMModerationResponse, ModerationPolicy } from '../types'
import { loadPolicy } from './heuristics'

export async function moderateWithLLM(
  content: {
    filename?: string
    transcript?: string
    ocrText?: string
    userDescription?: string
  }
): Promise<LLMModerationResponse> {
  const policy = await loadPolicy()

  // Prepare the content for moderation
  const contentParts: string[] = []

  if (content.filename) {
    contentParts.push(`Filename: ${content.filename}`)
  }
  if (content.transcript) {
    contentParts.push(`Audio transcript: ${content.transcript}`)
  }
  if (content.ocrText) {
    contentParts.push(`On-screen text: ${content.ocrText}`)
  }
  if (content.userDescription) {
    contentParts.push(`User description: ${content.userDescription}`)
  }

  const contentToModerate = contentParts.join('\n\n')

  if (!contentToModerate.trim()) {
    // No content to moderate, pass by default
    return {
      verdict: 'SAFE',
      confidence: 1.0,
      categories: [],
      notes: 'No content to moderate',
    }
  }

  try {
    // Use OpenAI or vLLM endpoint
    const endpoint = process.env.VLLM_ENDPOINT || 'https://api.openai.com/v1'
    const apiKey = process.env.OPENAI_API_KEY

    const systemPrompt = buildModerationPrompt(policy)

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Please review this content for Twitch ToS compliance:\n\n${contentToModerate}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`)
    }

    const data = await response.json()
    const llmResponse = data.choices[0].message.content

    // Parse the LLM response (expecting JSON)
    try {
      const parsed = JSON.parse(llmResponse)
      return {
        verdict: parsed.verdict || 'UNSAFE',
        confidence: parsed.confidence || 0.5,
        categories: parsed.categories || [],
        notes: parsed.notes || llmResponse,
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract verdict from text
      const isUnsafe = /UNSAFE|DENY|REJECTED|VIOLATION/i.test(llmResponse)

      return {
        verdict: isUnsafe ? 'UNSAFE' : 'SAFE',
        confidence: 0.7,
        categories: isUnsafe ? ['other'] : [],
        notes: llmResponse,
      }
    }
  } catch (error) {
    console.error('LLM moderation error:', error)

    // On error, fail safe and deny
    return {
      verdict: 'UNSAFE',
      confidence: 0.5,
      categories: ['error'],
      notes: `Moderation error: ${error}`,
    }
  }
}

function buildModerationPrompt(policy: ModerationPolicy): string {
  const categories = Object.entries(policy.categories)
    .filter(([_, config]) => config.deny)
    .map(([category, config]) => `- ${category}: ${config.notes || ''}`)
    .join('\n')

  return `You are a compliance gate for Twitch alerts. Apply the provided POLICY strictly.
If uncertain, respond UNSAFE.
Return JSON: {"verdict":"SAFE|UNSAFE","confidence":0..1,"categories":[...], "notes": "..."}

POLICY - DENY the following categories:
${categories}

Key rules:
1. Deny sexual content (incl. moans, sexualized sounds, innuendo), nudity
2. Deny hate/harassment (slurs, insults at people/groups)
3. Deny threats, violence celebration, self-harm
4. Deny doxxing/personal data, illegal/dangerous acts, political persuasion
5. Deny minors in adult contexts; deny if age ambiguous
6. Deny copyrighted music/sfx unless declared royalty-free
7. Profanity only if not targeted and not sexual; otherwise deny
8. If any uncertainty, return UNSAFE
9. Confidence threshold: ${policy.confidence_threshold}. If below, return UNSAFE.

Be extremely conservative. When in doubt, deny.`
}
