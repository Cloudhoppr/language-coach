'use client'

import { useRef, useEffect, type KeyboardEvent } from 'react'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  isLoading?: boolean
}

export function TextInput({ value, onChange, onSubmit, disabled = false, isLoading = false }: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus when not disabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [disabled])

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled && !isLoading) {
        onSubmit()
      }
    }
  }

  const canSubmit = value.trim().length > 0 && !disabled && !isLoading

  return (
    <div className="flex items-end gap-2 flex-1">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        placeholder="Type a message in English or Spanish..."
        className={[
          'flex-1 resize-none px-4 py-2.5 rounded-xl border text-sm leading-relaxed',
          'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
          'placeholder-gray-400 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500',
          'transition-colors overflow-y-auto',
          disabled
            ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-700',
        ].join(' ')}
      />

      <button
        type="button"
        onClick={() => canSubmit && onSubmit()}
        disabled={!canSubmit}
        aria-label="Send message"
        className={[
          'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
          canSubmit
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed',
        ].join(' ')}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
          </svg>
        )}
      </button>
    </div>
  )
}
