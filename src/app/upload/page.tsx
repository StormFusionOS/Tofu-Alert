'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg']
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload MP4, WebM, WAV, or MP3.')
      setFile(null)
      return
    }

    // Validate file size (25MB)
    const maxSize = 25 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 25MB.')
      setFile(null)
      return
    }

    setError(null)
    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      // Step 1: Request presigned upload URL
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create alert')
      }

      const { data } = await response.json()
      const { uploadUrl, alertId } = data

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      // Step 3: Trigger moderation (handled automatically by backend)
      // For now, just redirect to dashboard
      alert('Upload successful! Your alert is being reviewed. This usually takes 1-5 minutes.')
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload Custom Alert</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Upload your custom alert (max 10 seconds, max 25MB)
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Requirements</h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>Active Tier 3 subscription required</li>
              <li>Video: MP4 or WebM format</li>
              <li>Audio: WAV or MP3 format</li>
              <li>Maximum duration: 10 seconds</li>
              <li>Maximum file size: 25MB</li>
              <li>Content must comply with Twitch ToS</li>
              <li>No copyrighted music</li>
              <li>No personal information (emails, phone numbers, etc.)</li>
            </ul>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select File
            </label>
            <input
              type="file"
              accept="video/mp4,video/webm,audio/wav,audio/mp3,audio/mpeg"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none p-2"
            />
          </div>

          {file && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
              <p className="text-sm font-medium">Selected file:</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{file.name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Alert'}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2 text-yellow-900 dark:text-yellow-200">
            ⚠️ Content Policy
          </h2>
          <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-4">
            All uploads are reviewed by an automated moderation system. Content that violates Twitch ToS will be automatically denied.
          </p>
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Prohibited content includes but is not limited to: sexual content, hate speech, harassment, violence, illegal activities, personal information, copyrighted material, and political content.
          </p>
        </div>
      </div>
    </main>
  )
}
