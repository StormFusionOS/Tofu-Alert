import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Tofu Alert - Tier 3 Custom Alerts
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="border border-gray-300 rounded-lg p-6 hover:border-gray-400 transition">
            <h2 className="text-2xl font-semibold mb-4">For Subscribers</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Upload your custom alert (Tier 3 only). Max 10 seconds.
            </p>
            <Link
              href="/upload"
              className="inline-block bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition"
            >
              Upload Alert
            </Link>
          </div>

          <div className="border border-gray-300 rounded-lg p-6 hover:border-gray-400 transition">
            <h2 className="text-2xl font-semibold mb-4">For Streamers</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Manage alerts, review submissions, and control settings.
            </p>
            <Link
              href="/admin"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            >
              Admin Panel
            </Link>
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-300">
            <li>Tier 3 subscribers upload a custom alert (video or audio, max 10 seconds)</li>
            <li>Our moderation system reviews the content for Twitch ToS compliance</li>
            <li>Once approved, trigger your alert in chat with <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">!myalert</code></li>
            <li>You can trigger your alert once every 24 hours</li>
            <li>The alert plays on the stream overlay for all viewers</li>
          </ol>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/overlay"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            View Overlay Page (for OBS)
          </Link>
        </div>
      </div>
    </main>
  )
}
