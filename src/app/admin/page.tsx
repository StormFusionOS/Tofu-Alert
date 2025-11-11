'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [filter])

  const fetchData = async () => {
    try {
      const [settingsRes, alertsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch(`/api/admin/reviews?status=${filter}`),
      ])

      if (!settingsRes.ok || !alertsRes.ok) {
        router.push('/')
        return
      }

      const settingsData = await settingsRes.json()
      const alertsData = await alertsRes.json()

      setSettings(settingsData.data)
      setAlerts(alertsData.data)
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMute = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertsMuted: !settings.alertsMuted }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data.data)
      }
    } catch (error) {
      console.error('Error toggling mute:', error)
    }
  }

  const approveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        alert('Alert approved!')
        fetchData()
      }
    } catch (error) {
      console.error('Error approving alert:', error)
    }
  }

  const denyAlert = async (alertId: string) => {
    const reason = prompt('Enter denial reason:')
    if (!reason) return

    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (response.ok) {
        alert('Alert denied!')
        fetchData()
      }
    } catch (error) {
      console.error('Error denying alert:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

        {/* Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.alertsMuted || false}
                onChange={toggleMute}
                className="w-5 h-5"
              />
              <span className="font-medium">Mute All Alerts</span>
            </label>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              (Also controllable via chat: !alerts off/on)
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Cooldown</p>
              <p className="text-2xl font-bold">{settings?.cooldownHours || 24}h</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Max Duration</p>
              <p className="text-2xl font-bold">{settings?.maxDurationSec || 10}s</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Max File Size</p>
              <p className="text-2xl font-bold">{settings?.maxFileSizeMB || 25}MB</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-2">
          {['pending', 'approved', 'denied'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({alerts.length})
            </button>
          ))}
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center shadow">
              <p className="text-gray-600 dark:text-gray-300">No {filter} alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {alert.user.displayName} (@{alert.user.login})
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Alert ID: {alert.id.substring(0, 12)}...
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Duration: {alert.durationSec}s | Type: {alert.mimeType}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Uploaded: {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      alert.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : alert.status === 'denied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>

                {/* Reviews */}
                {alert.reviews && alert.reviews.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Review History:</h4>
                    <div className="space-y-2">
                      {alert.reviews.map((review: any) => (
                        <div
                          key={review.id}
                          className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded"
                        >
                          <span className="font-medium">{review.stage}:</span>{' '}
                          <span
                            className={
                              review.verdict === 'pass'
                                ? 'text-green-600'
                                : review.verdict === 'fail'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }
                          >
                            {review.verdict}
                          </span>
                          {review.details && (
                            <pre className="mt-1 text-xs overflow-x-auto">
                              {JSON.stringify(JSON.parse(review.details), null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {alert.denialReason && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      <strong>Denial Reason:</strong> {alert.denialReason}
                    </p>
                  </div>
                )}

                {/* Preview */}
                {alert.cdnUrl && (
                  <div className="mb-4">
                    <video
                      src={alert.cdnUrl}
                      controls
                      className="max-w-md rounded"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}

                {/* Actions */}
                {alert.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveAlert(alert.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => denyAlert(alert.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
