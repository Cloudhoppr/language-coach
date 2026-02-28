'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Session } from '@/lib/types'

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_LABELS: Record<Session['status'], string> = {
  active: 'Active',
  ended: 'Ended',
  analyzed: 'Analyzed',
}

const STATUS_COLORS: Record<Session['status'], string> = {
  active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  ended: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  analyzed: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
}

interface SessionListProps {
  /** If true, only show last 10 sessions (for sidebar) */
  compact?: boolean
}

export function SessionList({ compact = false }: SessionListProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    api.getSessions()
      .then((data) => setSessions(compact ? data.slice(0, 10) : data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [compact])

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setDeletingId(id)
    setConfirmDeleteId(null)
    try {
      await api.deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch {
      // Silently fail — session stays in list
    } finally {
      setDeletingId(null)
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDeleteId(null)
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400 dark:text-gray-500"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">No sessions yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your past conversations will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => router.push(`/history/${session.id}`)}
          className="group relative flex flex-col gap-1 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm cursor-pointer transition-all"
        >
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
              {session.title}
            </span>
            <span
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[session.status]}`}
            >
              {STATUS_LABELS[session.status]}
            </span>
          </div>

          {/* Date */}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(session.updated_at)}
          </span>

          {/* Delete / confirm row */}
          <div
            className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDeleteId === session.id ? (
              <>
                <button
                  onClick={(e) => handleDelete(session.id, e)}
                  disabled={deletingId === session.id}
                  className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === session.id ? '...' : 'Confirm'}
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={(e) => handleDelete(session.id, e)}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                aria-label="Delete session"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
