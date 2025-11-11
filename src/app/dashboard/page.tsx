'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me')
      if (!response.ok) {
        router.push('/api/auth/twitch')
        return
      }

      const data = await response.json()
      setUser(data.data)
      setAlerts(data.data.alerts || [])
    } catch (error) {
      console.error('Error fetching user data:', error)
      router.push('/api/auth/twitch')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  const subscription = user?.subscription
  const isTier3 = subscription?.tier === 3000 && subscription?.isActive

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Welcome back, {user?.displayName}!
          </p>
        </div>

        {/* Subscription Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Subscription Status</h2>
          {isTier3 ? (
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400 font-bold">
                ✓ Tier 3 Active
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-red-600 dark:text-red-400 font-bold">
                ✗ Not Tier 3
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You need an active Tier 3 subscription to upload custom alerts.
              </p>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Your Alerts</h2>

          {isTier3 && alerts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You haven't uploaded an alert yet.
              </p>
              <button
                onClick={() => router.push('/upload')}
                className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition"
              >
                Upload Alert
              </button>
            </div>
          )}

          {alerts.length > 0 && (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">Alert #{alert.id.substring(0, 8)}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Duration: {alert.durationSec}s
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        alert.status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : alert.status === 'denied'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {alert.status}
                    </span>
                  </div>

                  {alert.status === 'denied' && alert.denialReason && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        <strong>Reason:</strong> {alert.denialReason}
                      </p>
                    </div>
                  )}

                  {alert.status === 'approved' && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Trigger in chat with: <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">!myalert</code>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
