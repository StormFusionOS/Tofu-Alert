import ffmpeg from 'fluent-ffmpeg'
import { promisify } from 'util'
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface MediaInfo {
  duration: number
  hasVideo: boolean
  hasAudio: boolean
  videoCodec?: string
  audioCodec?: string
  width?: number
  height?: number
  audioLUFS?: number
}

export async function probeMedia(filePath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio')

      const info: MediaInfo = {
        duration: metadata.format.duration || 0,
        hasVideo: !!videoStream,
        hasAudio: !!audioStream,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        width: videoStream?.width,
        height: videoStream?.height,
      }

      resolve(info)
    })
  })
}

export async function validateDuration(
  filePath: string,
  maxDuration: number
): Promise<{ valid: boolean; duration: number }> {
  const info = await probeMedia(filePath)

  return {
    valid: info.duration <= maxDuration,
    duration: info.duration,
  }
}

export async function normalizeAudio(
  inputPath: string,
  outputPath: string,
  targetLUFS: number = -14
): Promise<{ lufs: number; outputPath: string }> {
  // First pass: measure LUFS
  const measureCommand = `ffmpeg -i "${inputPath}" -af loudnorm=I=${targetLUFS}:print_format=json -f null - 2>&1 | grep -A 12 "Parsed_loudnorm"`

  let measured_I = targetLUFS
  try {
    const { stdout } = await execAsync(measureCommand)
    const jsonMatch = stdout.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const loudnormData = JSON.parse(jsonMatch[0])
      measured_I = parseFloat(loudnormData.input_i)
    }
  } catch (error) {
    // If measurement fails, proceed with default normalization
    console.warn('LUFS measurement failed, using default normalization')
  }

  // Second pass: apply normalization
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(`loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })

  return {
    lufs: measured_I,
    outputPath,
  }
}

export async function transcodeToWeb(
  inputPath: string,
  outputPath: string,
  options: {
    maxWidth?: number
    maxHeight?: number
    videoBitrate?: string
    audioBitrate?: string
  } = {}
): Promise<string> {
  const { maxWidth = 1920, maxHeight = 1080, videoBitrate = '2000k', audioBitrate = '128k' } = options

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoBitrate(videoBitrate)
      .audioBitrate(audioBitrate)
      .size(`${maxWidth}x${maxHeight}`)
      .outputOptions([
        '-preset fast',
        '-crf 22',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))

    command.run()
  })

  return outputPath
}

export async function extractAudio(inputPath: string, outputPath: string): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })

  return outputPath
}

export async function extractKeyframes(
  inputPath: string,
  outputDir: string,
  count: number = 3
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true })

  const info = await probeMedia(inputPath)
  const duration = info.duration

  const timestamps = []
  for (let i = 0; i < count; i++) {
    timestamps.push((duration / (count + 1)) * (i + 1))
  }

  const outputPaths: string[] = []

  for (let i = 0; i < timestamps.length; i++) {
    const outputPath = path.join(outputDir, `frame_${i}.jpg`)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamps[i]],
          filename: `frame_${i}.jpg`,
          folder: outputDir,
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
    })
    outputPaths.push(outputPath)
  }

  return outputPaths
}

export async function generatePerceptualHash(filePath: string): Promise<string> {
  // Generate a perceptual hash using ffmpeg's signature filter
  const tempOutput = `/tmp/signature_${Date.now()}.bin`

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions(['-vf', 'signature=filename=' + tempOutput])
        .output('/dev/null')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    const signature = await fs.readFile(tempOutput, 'hex')
    await fs.unlink(tempOutput)

    return signature.substring(0, 64) // Return first 64 chars as hash
  } catch (error) {
    // Fallback to a simple hash based on file metadata
    const info = await probeMedia(filePath)
    const hashInput = `${info.duration}_${info.width}_${info.height}_${info.videoCodec}_${info.audioCodec}`
    return Buffer.from(hashInput).toString('hex').substring(0, 64)
  }
}
