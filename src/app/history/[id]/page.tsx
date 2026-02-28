'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { MessageList } from '@/components/chat/message-list'
import type { Session, Message } from '@/lib/types'

interface SessionDetailPageProps {
  params: Promise<{ id: string }>
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => setSessionId(id))
  }, [params])

  useEffect(() => {
    if (!sessionId) return

    Promise.all([api.getSession(sessionId), api.getMessages(sessionId)])
      .then(([sess, msgs]) => {
        setSession(sess)
        setMessages(msgs)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session'))
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <Link
          href="/history"
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          aria-label="Back to history"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <h2 className="text-lg font-semibold truncate">
              {session?.title ?? 'Session Detail'}
            </h2>
          )}
        </div>

        {/* Status badge */}
        {session && (
          <span
            className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              session.status === 'analyzed'
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : session.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </span>
        )}
      </header>

      {/* Content */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-red-500 dark:text-red-400 font-medium">Failed to load session</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <Link
              href="/history"
              className="inline-block mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Back to history
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 p-6 space-y-4 max-w-3xl mx-auto w-full">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? 'flex-row-reverse' : 'flex-row'} gap-2`}
            >
              {i % 2 !== 0 && (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
              )}
              <div
                className={`h-12 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse ${
                  i % 2 === 0 ? 'w-48' : 'w-64'
                }`}
              />
            </div>
          ))}
        </div>
      ) : (
        <MessageList messages={messages} />
      )}

      {/* Feedback hint for analyzed sessions */}
      {session?.status === 'analyzed' && !loading && !error && (
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-indigo-50 dark:bg-indigo-900/20">
          <p className="text-sm text-indigo-700 dark:text-indigo-300 text-center">
            This session has been analyzed. Feedback panel coming in Phase 10.
          </p>
        </div>
      )}
    </div>
  )
}
