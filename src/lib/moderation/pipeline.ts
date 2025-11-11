import prisma from '../db'
import { downloadFile, uploadFile, getCDNUrl } from '../storage'
import {
  probeMedia,
  validateDuration,
  normalizeAudio,
  transcodeToWeb,
  extractAudio,
  extractKeyframes,
  generatePerceptualHash,
} from './ffmpeg'
import { runHeuristicChecks, checkTextContent, calculateRiskScore } from './heuristics'
import { transcribeAudio, transcribeWithOpenAI } from './stt'
import { extractTextFromMultipleFrames } from './ocr'
import { moderateWithLLM } from './llm'
import { AlertStatus, ReviewStage, ReviewVerdict } from '../types'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface ModerationResult {
  alertId: string
  status: AlertStatus
  denialReason?: string
  cdnUrl?: string
}

export async function runModerationPipeline(alertId: string): Promise<ModerationResult> {
  console.log(`[Moderation] Starting pipeline for alert ${alertId}`)

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: { user: true },
  })

  if (!alert) {
    throw new Error(`Alert ${alertId} not found`)
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tofu-alert-'))

  try {
    // Download the file
    const srcKey = alert.srcUrl.replace(/^https?:\/\/[^\/]+\//, '')
    const filePath = path.join(tempDir, 'original' + path.extname(srcKey))
    const buffer = await downloadFile(srcKey)
    await fs.writeFile(filePath, buffer)

    // Stage 1: Heuristics
    console.log(`[Moderation] Stage 1: Heuristics`)
    const fileSizeMB = buffer.length / (1024 * 1024)
    const heuristicResult = await runHeuristicChecks(
      path.basename(srcKey),
      alert.mimeType,
      alert.durationSec,
      fileSizeMB
    )

    await createReview(alertId, 'heuristic', heuristicResult.passed ? 'pass' : 'fail', {
      flags: heuristicResult.flags,
      details: heuristicResult.details,
    })

    if (!heuristicResult.passed) {
      const riskScore = calculateRiskScore(heuristicResult.flags)
      if (riskScore >= 8) {
        return await denyAlert(alertId, `Heuristic check failed: ${heuristicResult.details.join('; ')}`)
      }
    }

    // Stage 2: Media validation and processing
    console.log(`[Moderation] Stage 2: Media validation`)
    const mediaInfo = await probeMedia(filePath)
    const durationCheck = await validateDuration(filePath, 10)

    if (!durationCheck.valid) {
      return await denyAlert(alertId, `Duration ${durationCheck.duration}s exceeds maximum 10s`)
    }

    // Update alert with actual duration
    await prisma.alert.update({
      where: { id: alertId },
      data: { durationSec: Math.ceil(durationCheck.duration) },
    })

    // Stage 3: Extract audio and transcribe
    let transcript = ''
    if (mediaInfo.hasAudio) {
      console.log(`[Moderation] Stage 3: STT`)
      const audioPath = path.join(tempDir, 'audio.wav')
      await extractAudio(filePath, audioPath)

      // Try OpenAI Whisper if API key is available
      const sttResult = process.env.OPENAI_API_KEY
        ? await transcribeWithOpenAI(audioPath)
        : await transcribeAudio(audioPath)

      transcript = sttResult.transcript

      // Check transcript content
      if (transcript) {
        const textCheck = await checkTextContent(transcript)
        await createReview(alertId, 'stt', textCheck.passed ? 'pass' : 'fail', {
          transcript,
          language: sttResult.language,
          confidence: sttResult.confidence,
          flags: textCheck.flags,
          details: textCheck.details,
        })

        if (!textCheck.passed) {
          const riskScore = calculateRiskScore(textCheck.flags)
          if (riskScore >= 8) {
            return await denyAlert(alertId, `STT check failed: ${textCheck.details.join('; ')}`)
          }
        }
      }
    }

    // Stage 4: OCR (if video)
    let ocrText = ''
    if (mediaInfo.hasVideo) {
      console.log(`[Moderation] Stage 4: OCR`)
      const framesDir = path.join(tempDir, 'frames')
      const framePaths = await extractKeyframes(filePath, framesDir, 3)
      const ocrResult = await extractTextFromMultipleFrames(framePaths)
      ocrText = ocrResult.text

      if (ocrText) {
        const textCheck = await checkTextContent(ocrText)
        await createReview(alertId, 'ocr', textCheck.passed ? 'pass' : 'fail', {
          text: ocrText,
          confidence: ocrResult.confidence,
          flags: textCheck.flags,
          details: textCheck.details,
        })

        if (!textCheck.passed) {
          const riskScore = calculateRiskScore(textCheck.flags)
          if (riskScore >= 8) {
            return await denyAlert(alertId, `OCR check failed: ${textCheck.details.join('; ')}`)
          }
        }
      }
    }

    // Stage 5: LLM moderation
    console.log(`[Moderation] Stage 5: LLM`)
    const llmResult = await moderateWithLLM({
      filename: path.basename(srcKey),
      transcript,
      ocrText,
    })

    await createReview(
      alertId,
      'llm',
      llmResult.verdict === 'SAFE' ? 'pass' : 'fail',
      {
        verdict: llmResult.verdict,
        confidence: llmResult.confidence,
        categories: llmResult.categories,
        notes: llmResult.notes,
      }
    )

    if (llmResult.verdict === 'UNSAFE' || llmResult.confidence < 0.9) {
      return await denyAlert(
        alertId,
        `LLM moderation failed: ${llmResult.notes} (confidence: ${llmResult.confidence})`
      )
    }

    // Stage 6: Content hash check
    console.log(`[Moderation] Stage 6: Duplicate check`)
    const hash = await generatePerceptualHash(filePath)

    const duplicates = await prisma.alert.findMany({
      where: {
        hashes: hash,
        status: 'denied',
      },
    })

    if (duplicates.length > 0) {
      return await denyAlert(alertId, 'Content matches a previously denied alert')
    }

    await prisma.alert.update({
      where: { id: alertId },
      data: { hashes: hash },
    })

    // Stage 7: Transcode and normalize
    console.log(`[Moderation] Stage 7: Processing`)
    const processedPath = path.join(tempDir, 'processed.mp4')

    if (mediaInfo.hasVideo) {
      await transcodeToWeb(filePath, processedPath)
    } else {
      // Audio only - normalize
      await normalizeAudio(filePath, processedPath, -14)
    }

    // Normalize audio levels
    if (mediaInfo.hasAudio) {
      const normalizedPath = path.join(tempDir, 'normalized.mp4')
      const { lufs } = await normalizeAudio(processedPath, normalizedPath, -14)

      await prisma.alert.update({
        where: { id: alertId },
        data: { audioLufs: lufs },
      })

      // Use normalized version
      await fs.copyFile(normalizedPath, processedPath)
    }

    // Upload to CDN
    const processedBuffer = await fs.readFile(processedPath)
    const cdnKey = `approved/${alertId}.mp4`
    const cdnUrl = await uploadFile(processedBuffer, cdnKey, 'video/mp4')

    // Approve alert
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'approved',
        cdnUrl,
        reviewedAt: new Date(),
      },
    })

    console.log(`[Moderation] Alert ${alertId} approved`)

    return {
      alertId,
      status: 'approved',
      cdnUrl,
    }
  } catch (error) {
    console.error(`[Moderation] Error processing alert ${alertId}:`, error)
    return await denyAlert(alertId, `Processing error: ${error}`)
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  }
}

async function createReview(
  alertId: string,
  stage: ReviewStage,
  verdict: ReviewVerdict,
  details: any
): Promise<void> {
  await prisma.review.create({
    data: {
      alertId,
      stage,
      verdict,
      details: JSON.stringify(details),
    },
  })
}

async function denyAlert(alertId: string, reason: string): Promise<ModerationResult> {
  await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: 'denied',
      denialReason: reason,
      reviewedAt: new Date(),
    },
  })

  console.log(`[Moderation] Alert ${alertId} denied: ${reason}`)

  return {
    alertId,
    status: 'denied',
    denialReason: reason,
  }
}
