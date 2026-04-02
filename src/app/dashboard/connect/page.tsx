'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type Connection = {
  id: string
  stripe_account_id: string | null
  account_name: string | null
  status: string
  created_at: string
  last_sync_at: string | null
}

function ConnectPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Check URL params for post-connect feedback
  useEffect(() => {
    const status = searchParams.get('status')
    const account = searchParams.get('account')
    const reason = searchParams.get('reason')

    if (status === 'success' && account) {
      setNotice(`Stripe account ${account} connected successfully! Your first sync is running.`)
    }
    if (status === 'error') {
      setError(reason || 'Connection failed. Please try again.')
    }
  }, [searchParams])

  // Load existing connections
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/user/connection-status', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const json = await res.json()
        if (!cancelled) {
          setConnections(json.connections || [])
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load connections')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  // Initiate Stripe OAuth â€” calls ?action=start, gets URL, redirects
  async function handleConnect() {
    try {
      setConnecting(true)
      setError(null)
      const res = await fetch('/api/stripe/connect?action=start', {
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to start connection')
      if (json.url) {
        window.location.href = json.url
      } else {
        throw new Error('No OAuth URL returned')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to connect')
      setConnecting(false)
    }
  }

  // Disconnect
  async function handleDisconnect(connectionId: string) {
    if (!confirm('Disconnect this Stripe account? You can reconnect later.')) return
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to disconnect')
      }
      // Refresh connections
      const connRes = await fetch('/api/user/connection-status', { cache: 'no-store' })
      const connJson = await connRes.json()
      setConnections(connJson.connections || [])
      setNotice('Account disconnected.')
    } catch (e: any) {
      setError(e?.message || 'Disconnect failed')
    }
  }

  const activeConnections = connections.filter(c => c.status === 'active')

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Connect Stripe</h1>
        <p className="mt-1 text-sm text-gray-400">
          Link your Stripe account so Corvidet can scan for revenue leaks.
        </p>
      </div>

      {/* Notices */}
      {notice && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-900/30 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Existing connections */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading connections...
        </div>
      ) : activeConnections.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Connected Accounts
          </h2>
          {activeConnections.map(conn => (
            <div
              key={conn.id}
              className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/60 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/40 text-emerald-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-white">
                    {conn.account_name || conn.stripe_account_id || 'Stripe Account'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {conn.stripe_account_id}
                    {conn.last_sync_at && (
                      <> Â· Last sync: {new Date(conn.last_sync_at).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-400">
                  Active
                </span>
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  className="rounded-lg border border-red-900/50 px-3 py-1 text-xs text-red-400 hover:bg-red-900/20"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push('/dashboard/leaks')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Go to Leak Scanner
            </button>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-60"
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
              + Add Another Account
            </button>
          </div>
        </div>
      ) : (
        /* No connections â€” onboarding CTA */
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-900/40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>

          <h2 className="mb-2 text-xl font-semibold text-white">
            Connect your Stripe account
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-gray-400">
            Corvidet uses read-only OAuth access to analyze your subscriptions,
            detect failed payments, expiring cards, and churn risks â€” then shows
            you exactly how to recover the revenue.
          </p>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#635BFF] px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-[#7A73FF] disabled:opacity-60"
          >
            {connecting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
            {connecting ? 'Redirecting to Stripe...' : 'Connect with Stripe'}
          </button>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Read-only access
            </span>
            <span>Â·</span>
            <span>OAuth 2.0</span>
            <span>Â·</span>
            <span>Disconnect anytime</span>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
          How It Works
        </h2>
        <div className="grid gap-3">
          {[
            {
              step: '1',
              title: 'Authorize read-only access',
              desc: 'You\'ll be redirected to Stripe to grant Corvidet read-only access. We never modify your billing data.',
            },
            {
              step: '2',
              title: 'Automatic sync',
              desc: 'Corvidet pulls your subscriptions, invoices, and payment history. First sync takes under a minute.',
            },
            {
              step: '3',
              title: 'Scan for leaks',
              desc: 'Our engine detects failed payments, expiring cards, pending cancellations, and zombie subscriptions.',
            },
          ].map(item => (
            <div key={item.step} className="flex gap-4 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-900/30 text-sm font-bold text-blue-400">
                {item.step}
              </div>
              <div>
                <div className="font-medium text-white">{item.title}</div>
                <div className="text-sm text-gray-400">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-2xl px-4 py-8 text-sm text-gray-400">
          Loading connection status...
        </div>
      }
    >
      <ConnectPageContent />
    </Suspense>
  )
}
