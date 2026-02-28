'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConversation } from '@/hooks/use-conversation'
import { useSessionStore } from '@/stores/session-store'
import { MicButton } from '@/components/chat/mic-button'
import { MessageList } from '@/components/chat/message-list'
import { TextInput } from '@/components/chat/text-input'
import { Waveform2D } from '@/components/visualizer/waveform-2d'
import { api } from '@/lib/api'
import type { Message } from '@/lib/types'

type MicState = 'idle' | 'connecting' | 'recording' | 'error'

export default function Home() {
  const conversation = useConversation()
  const {
    connect,
    disconnect,
    isConnected,
    isSpeaking,
    error: convError,
    onUserTranscript,
    onAgentResponse,
    userAnalyser,
    agentAnalyser,
  } = conversation

  const { currentSession, setCurrentSession, messages, addMessage } = useSessionStore()
  const [micState, setMicState] = useState<MicState>('idle')

  // Partial user transcript (live, not yet finalized)
  const [partialUserText, setPartialUserText] = useState<string | null>(null)
  // Whether the AI is processing (user finished speaking, AI hasn't responded yet)
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  // Track message count to trigger title generation after 6 messages (3 exchanges)
  const messageCountRef = useRef(0)

  // Text input state
  const [textValue, setTextValue] = useState('')
  const [isTextLoading, setIsTextLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Subscribe to transcript events from the conversation hook
  // ---------------------------------------------------------------------------
  useEffect(() => {
    onUserTranscript((text, isFinal) => {
      if (isFinal) {
        // Clear partial text and show thinking indicator
        setPartialUserText(null)
        setIsAgentThinking(true)

        // Build a local message object to show immediately
        const msg: Message = {
          id: crypto.randomUUID(),
          session_id: currentSession?.id ?? '',
          role: 'user',
          content: text,
          original_audio_url: null,
          language: null,
          created_at: new Date().toISOString(),
        }
        addMessage(msg)
        messageCountRef.current += 1

        // Persist to Supabase (fire-and-forget)
        if (currentSession?.id) {
          api.createMessage({
            session_id: currentSession.id,
            role: 'user',
            content: text,
          }).then((saved) => {
            // Optionally we could replace the optimistic message with the saved one,
            // but for simplicity we just trigger title generation after 6 messages.
            void saved
          }).catch(() => {
            // Non-critical: message display already happened optimistically
          })

          // Auto-generate title after first 6 messages (3 exchanges)
          if (messageCountRef.current === 6) {
            api.generateTitle(currentSession.id)
              .then((updated) => setCurrentSession(updated))
              .catch(() => {})
          }
        }
      } else {
        // Partial transcript — show as live typing indicator
        setPartialUserText(text)
      }
    })

    onAgentResponse((text) => {
      setIsAgentThinking(false)

      const msg: Message = {
        id: crypto.randomUUID(),
        session_id: currentSession?.id ?? '',
        role: 'assistant',
        content: text,
        original_audio_url: null,
        language: null,
        created_at: new Date().toISOString(),
      }
      addMessage(msg)
      messageCountRef.current += 1

      // Persist to Supabase (fire-and-forget)
      if (currentSession?.id) {
        api.createMessage({
          session_id: currentSession.id,
          role: 'assistant',
          content: text,
        }).catch(() => {})

        if (messageCountRef.current === 6) {
          api.generateTitle(currentSession.id)
            .then((updated) => setCurrentSession(updated))
            .catch(() => {})
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id])

  // Clear thinking indicator when AI starts speaking
  useEffect(() => {
    if (isSpeaking) {
      setIsAgentThinking(false)
    }
  }, [isSpeaking])

  // Clear partial text and thinking when disconnected
  useEffect(() => {
    if (!isConnected) {
      setPartialUserText(null)
      setIsAgentThinking(false)
    }
  }, [isConnected])

  // ---------------------------------------------------------------------------
  // Text input handler
  // ---------------------------------------------------------------------------
  const handleTextSubmit = useCallback(async () => {
    const trimmed = textValue.trim()
    if (!trimmed || isTextLoading) return

    setTextValue('')
    setIsTextLoading(true)

    // Ensure a session exists
    let sessionId = currentSession?.id
    if (!sessionId) {
      const session = await api.createSession()
      setCurrentSession(session)
      sessionId = session.id
      messageCountRef.current = 0
    }

    // Optimistic user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'user',
      content: trimmed,
      original_audio_url: null,
      language: null,
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)
    messageCountRef.current += 1

    try {
      const { reply } = await api.sendTextMessage(sessionId, trimmed)
      messageCountRef.current += 1

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: 'assistant',
        content: reply,
        original_audio_url: null,
        language: null,
        created_at: new Date().toISOString(),
      }
      addMessage(assistantMsg)

      // Auto-generate title after first 6 messages
      if (messageCountRef.current === 6) {
        api.generateTitle(sessionId)
          .then((updated) => setCurrentSession(updated))
          .catch(() => {})
      }
    } catch {
      // Non-critical: show nothing extra, message already optimistically shown
    } finally {
      setIsTextLoading(false)
    }
  }, [textValue, isTextLoading, currentSession, setCurrentSession, addMessage])

  // ---------------------------------------------------------------------------
  // Mic button handler
  // ---------------------------------------------------------------------------
  const handleMicClick = useCallback(async () => {
    if (isConnected) {
      disconnect()
      setMicState('idle')
      return
    }

    setMicState('connecting')

    try {
      let sessionId = currentSession?.id
      if (!sessionId) {
        const session = await api.createSession()
        setCurrentSession(session)
        sessionId = session.id
        messageCountRef.current = 0
      }

      await connect(sessionId)
      setMicState('recording')
    } catch {
      setMicState('error')
    }
  }, [isConnected, disconnect, connect, currentSession, setCurrentSession])

  const effectiveMicState: MicState =
    isConnected ? 'recording' : convError ? 'error' : micState

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h2 className="text-lg font-semibold truncate">
          {currentSession?.title ?? 'New Session'}
        </h2>
        {isConnected && (
          <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 flex-shrink-0 ml-4">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Connected
          </span>
        )}
      </header>

      {/* Message list */}
      <MessageList
        messages={messages}
        partialUserText={partialUserText}
        isAgentThinking={isAgentThinking}
      />

      {/* Waveform visualizer — shown when connected, collapsed otherwise */}
      {isConnected && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4">
          <Waveform2D
            userAnalyser={userAnalyser}
            agentAnalyser={agentAnalyser}
            isActive={isConnected}
          />
        </div>
      )}

      {/* Control bar */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4 flex-shrink-0">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          {/* Text input */}
          <TextInput
            value={textValue}
            onChange={setTextValue}
            onSubmit={handleTextSubmit}
            disabled={isConnected}
            isLoading={isTextLoading}
          />

          {/* Mic button */}
          <MicButton
            state={effectiveMicState}
            isSpeaking={isSpeaking}
            onClick={handleMicClick}
            errorMessage={convError}
          />
        </div>
      </div>
    </div>
  )
}
