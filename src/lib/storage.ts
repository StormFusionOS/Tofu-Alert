import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})

const BUCKET_NAME = process.env.S3_BUCKET!
const CDN_BASE_URL = process.env.CDN_BASE_URL!

export interface UploadOptions {
  folder?: string
  contentType?: string
  expiresIn?: number
}

export async function generatePresignedUploadUrl(
  filename: string,
  options: UploadOptions = {}
): Promise<{ url: string; key: string }> {
  const { folder = 'uploads', contentType = 'application/octet-stream', expiresIn = 3600 } = options

  // Generate a random filename to prevent collisions and strip metadata
  const ext = filename.split('.').pop()
  const randomName = `${crypto.randomBytes(16).toString('hex')}.${ext}`
  const key = `${folder}/${randomName}`

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(s3Client, command, { expiresIn })

  return { url, key }
}

export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  })

  await s3Client.send(command)

  return getCDNUrl(key)
}

export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const response = await s3Client.send(command)
  const chunks: Uint8Array[] = []

  if (!response.Body) {
    throw new Error('No body in S3 response')
  }

  // @ts-ignore - Body is a stream
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

export function getCDNUrl(key: string): string {
  return `${CDN_BASE_URL}/${key}`
}

export function extractKeyFromUrl(url: string): string | null {
  if (url.startsWith(CDN_BASE_URL)) {
    return url.substring(CDN_BASE_URL.length + 1)
  }
  return null
}

export async function moveFile(sourceKey: string, destKey: string): Promise<string> {
  // Download the file
  const buffer = await downloadFile(sourceKey)

  // Get the content type (we'll need to determine this)
  const ext = sourceKey.split('.').pop()
  const contentType = getContentTypeFromExtension(ext || '')

  // Upload to new location
  const newUrl = await uploadFile(buffer, destKey, contentType)

  // Delete old file
  await deleteFile(sourceKey)

  return newUrl
}

function getContentTypeFromExtension(ext: string): string {
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    mpeg: 'audio/mpeg',
  }

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
}
