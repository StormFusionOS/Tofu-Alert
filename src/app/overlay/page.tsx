'use client'

import { useEffect, useRef, useState } from 'react'

export default function OverlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [queue, setQueue] = useState<any[]>([])

  useEffect(() => {
    // Connect to WebSocket or use Server-Sent Events
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
    let ws: WebSocket

    const connect = () => {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[Overlay] Connected to WebSocket')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'trigger_alert') {
            console.log('[Overlay] Alert triggered:', data.data)
            setQueue((prev) => [...prev, data.data])
          }
        } catch (error) {
          console.error('[Overlay] Error parsing message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[Overlay] WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('[Overlay] WebSocket closed, reconnecting...')
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  useEffect(() => {
    if (queue.length > 0 && !isPlaying) {
      playAlert(queue[0])
    }
  }, [queue, isPlaying])

  const playAlert = async (alert: any) => {
    if (!videoRef.current) return

    setIsPlaying(true)

    try {
      videoRef.current.src = alert.cdnUrl
      videoRef.current.load()

      // Attempt to play
      await videoRef.current.play()

      // Force stop after max duration (10s + buffer)
      const timeout = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = 0
          videoRef.current.src = ''
          handleAlertEnd()
        }
      }, (alert.durationSec + 1) * 1000)

      // Cleanup timeout if video ends naturally
      videoRef.current.onended = () => {
        clearTimeout(timeout)
        handleAlertEnd()
      }
    } catch (error) {
      console.error('[Overlay] Error playing alert:', error)
      handleAlertEnd()
    }
  }

  const handleAlertEnd = () => {
    setIsPlaying(false)
    setQueue((prev) => prev.slice(1))

    if (videoRef.current) {
      videoRef.current.src = ''
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          display: isPlaying ? 'block' : 'none',
        }}
        playsInline
      />
    </div>
  )
}
