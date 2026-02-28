'use client'

import { useCallback } from 'react'

type MicState = 'idle' | 'connecting' | 'recording' | 'error'

interface MicButtonProps {
  state: MicState
  isSpeaking?: boolean
  onClick: () => void
  errorMessage?: string | null
}

export function MicButton({ state, isSpeaking = false, onClick, errorMessage }: MicButtonProps) {
  const handleClick = useCallback(() => {
    onClick()
  }, [onClick])

  // ---- Visual config per state ----
  const buttonConfig = {
    idle: {
      bg: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600',
      ring: '',
      icon: 'text-gray-600 dark:text-gray-300',
      pulse: false,
      cursor: 'cursor-pointer',
    },
    connecting: {
      bg: 'bg-yellow-400 dark:bg-yellow-500',
      ring: 'ring-4 ring-yellow-300 dark:ring-yellow-600',
      icon: 'text-yellow-900',
      pulse: true,
      cursor: 'cursor-wait',
    },
    recording: {
      bg: 'bg-red-500 hover:bg-red-600',
      ring: 'ring-4 ring-red-300 dark:ring-red-700',
      icon: 'text-white',
      pulse: true,
      cursor: 'cursor-pointer',
    },
    error: {
      bg: 'bg-red-600',
      ring: 'ring-4 ring-red-400',
      icon: 'text-white',
      pulse: false,
      cursor: 'cursor-pointer',
    },
  }[state]

  const ariaLabel =
    state === 'idle'
      ? 'Start voice conversation'
      : state === 'connecting'
        ? 'Connecting...'
        : state === 'recording'
          ? 'Stop voice conversation'
          : 'Retry connection'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* AI speaking ring animation */}
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full bg-indigo-400/40 animate-ping pointer-events-none" />
        )}

        {/* Pulse animation for connecting/recording */}
        {buttonConfig.pulse && !isSpeaking && (
          <span
            className={`absolute inset-0 rounded-full animate-ping pointer-events-none ${
              state === 'connecting'
                ? 'bg-yellow-400/50'
                : 'bg-red-500/50'
            }`}
          />
        )}

        <button
          onClick={handleClick}
          disabled={state === 'connecting'}
          aria-label={ariaLabel}
          className={[
            'relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200',
            buttonConfig.bg,
            buttonConfig.ring,
            buttonConfig.cursor,
          ].join(' ')}
        >
          {state === 'error' ? (
            // X icon for error state
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={buttonConfig.icon}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Mic icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={buttonConfig.icon}
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
      </div>

      {/* Status label */}
      <span className="text-xs text-gray-400 dark:text-gray-500 h-4">
        {state === 'connecting' && 'Connecting…'}
        {state === 'recording' && (isSpeaking ? 'Coach speaking…' : 'Listening…')}
        {state === 'error' && (errorMessage ?? 'Connection error')}
      </span>
    </div>
  )
}
