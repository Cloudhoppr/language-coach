'use client'

import { useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types for ElevenLabs Conversational AI WebSocket events
// ---------------------------------------------------------------------------

type ElevenLabsIncomingEvent =
  | { type: 'conversation_initiation_metadata'; conversation_id: string }
  | { type: 'user_transcript'; user_transcript: { text: string; is_final: boolean } }
  | { type: 'agent_response'; agent_response: { text: string } }
  | { type: 'agent_response_correction'; agent_response_correction: { text: string } }
  | { type: 'audio'; audio: { chunk: string; alignment?: object } }
  | { type: 'interruption' }
  | { type: 'ping'; ping_event: { event_id: number; ping_ms?: number } }

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseConversationReturn {
  connect: (sessionId: string) => Promise<void>
  disconnect: () => void
  isConnected: boolean
  isRecording: boolean
  isSpeaking: boolean
  error: string | null
  conversationId: string | null

  // AnalyserNodes for waveform visualizer (Phase 7)
  userAnalyser: AnalyserNode | null
  agentAnalyser: AnalyserNode | null

  // Transcript event subscriptions
  onUserTranscript: (callback: (text: string, isFinal: boolean) => void) => void
  onAgentResponse: (callback: (text: string) => void) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Float32 PCM samples to Int16 PCM buffer */
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

/** Encode an Int16Array to a base64 string */
function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Decode a base64 string to an ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversation(): UseConversationReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [userAnalyserState, setUserAnalyserState] = useState<AnalyserNode | null>(null)
  const [agentAnalyserState, setAgentAnalyserState] = useState<AnalyserNode | null>(null)

  // Mutable refs (don't trigger re-renders)
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Audio playback queue
  const playbackQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)
  const agentGainRef = useRef<GainNode | null>(null)

  // Transcript callbacks
  const userTranscriptCallbacksRef = useRef<Array<(text: string, isFinal: boolean) => void>>([])
  const agentResponseCallbacksRef = useRef<Array<(text: string) => void>>([])

  // ---------------------------------------------------------------------------
  // Transcript callback subscriptions
  // ---------------------------------------------------------------------------

  const onUserTranscript = useCallback(
    (callback: (text: string, isFinal: boolean) => void) => {
      userTranscriptCallbacksRef.current.push(callback)
    },
    []
  )

  const onAgentResponse = useCallback((callback: (text: string) => void) => {
    agentResponseCallbacksRef.current.push(callback)
  }, [])

  // ---------------------------------------------------------------------------
  // Audio playback queue
  // ---------------------------------------------------------------------------

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = []
    isPlayingRef.current = false
    setIsSpeaking(false)
  }, [])

  const playNextChunk = useCallback(async () => {
    if (!audioContextRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false
      setIsSpeaking(false)
      return
    }

    isPlayingRef.current = true
    setIsSpeaking(true)

    const chunk = playbackQueueRef.current.shift()!

    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(chunk)
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer

      // Connect through agent gain node (for analyser) -> destination
      const gainNode = agentGainRef.current
      if (gainNode) {
        source.connect(gainNode)
      } else {
        source.connect(audioContextRef.current.destination)
      }

      source.onended = () => {
        playNextChunk()
      }
      source.start(0)
    } catch {
      // If decode fails (e.g. raw PCM without header), skip and continue
      playNextChunk()
    }
  }, [])

  const enqueueAudioChunk = useCallback(
    (base64Chunk: string) => {
      const buffer = base64ToArrayBuffer(base64Chunk)
      playbackQueueRef.current.push(buffer)
      if (!isPlayingRef.current) {
        playNextChunk()
      }
    },
    [playNextChunk]
  )

  // ---------------------------------------------------------------------------
  // WebSocket message handler
  // ---------------------------------------------------------------------------

  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      let data: ElevenLabsIncomingEvent
      try {
        data = JSON.parse(event.data as string)
      } catch {
        return
      }

      switch (data.type) {
        case 'conversation_initiation_metadata':
          setConversationId(data.conversation_id)
          break

        case 'ping':
          wsRef.current?.send(
            JSON.stringify({ type: 'pong', event_id: data.ping_event.event_id })
          )
          break

        case 'user_transcript': {
          const { text, is_final } = data.user_transcript
          for (const cb of userTranscriptCallbacksRef.current) {
            cb(text, is_final)
          }
          break
        }

        case 'agent_response':
        case 'agent_response_correction': {
          const text =
            data.type === 'agent_response'
              ? data.agent_response.text
              : (data as { type: 'agent_response_correction'; agent_response_correction: { text: string } })
                  .agent_response_correction.text
          for (const cb of agentResponseCallbacksRef.current) {
            cb(text)
          }
          break
        }

        case 'audio':
          enqueueAudioChunk(data.audio.chunk)
          break

        case 'interruption':
          stopPlayback()
          break
      }
    },
    [enqueueAudioChunk, stopPlayback]
  )

  // ---------------------------------------------------------------------------
  // connect
  // ---------------------------------------------------------------------------

  const connect = useCallback(
    async (sessionId: string) => {
      setError(null)

      // 1. Get signed URL
      let signedUrl: string
      try {
        const result = await api.getSignedUrl()
        signedUrl = result.signed_url
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get signed URL'
        setError(msg)
        return
      }

      // 2. Set up AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // 3. Create AnalyserNodes
      const userAnalyser = audioContext.createAnalyser()
      userAnalyser.fftSize = 256
      setUserAnalyserState(userAnalyser)

      const agentAnalyser = audioContext.createAnalyser()
      agentAnalyser.fftSize = 256
      setAgentAnalyserState(agentAnalyser)

      // Agent audio chain: source -> gainNode -> agentAnalyser -> destination
      const agentGain = audioContext.createGain()
      agentGain.connect(agentAnalyser)
      agentAnalyser.connect(audioContext.destination)
      agentGainRef.current = agentGain

      // 4. Request microphone
      let micStream: MediaStream
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } catch {
        setError('Microphone permission denied')
        audioContext.close()
        return
      }
      micStreamRef.current = micStream

      // 5. Wire mic into AudioContext for capture
      const micSource = audioContext.createMediaStreamSource(micStream)
      micSourceRef.current = micSource

      // Connect mic source -> userAnalyser (for visualization only; no output)
      micSource.connect(userAnalyser)

      // ScriptProcessorNode for PCM capture (4096 buffer, 1 channel in/out)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      micSource.connect(processor)
      processor.connect(audioContext.destination) // must connect to destination to fire

      // 6. Open WebSocket
      const ws = new WebSocket(signedUrl)
      wsRef.current = ws

      ws.addEventListener('open', () => {
        setIsConnected(true)
        setIsRecording(true)

        // Start sending audio chunks after WS opens
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const float32 = e.inputBuffer.getChannelData(0)
          const int16 = float32ToInt16(float32)
          const b64 = int16ToBase64(int16)
          ws.send(JSON.stringify({ user_audio_chunk: b64 }))
        }
      })

      ws.addEventListener('message', handleWsMessage)

      ws.addEventListener('error', () => {
        setError('WebSocket connection error')
      })

      ws.addEventListener('close', () => {
        setIsConnected(false)
        setIsRecording(false)
        setIsSpeaking(false)
      })

      // Store sessionId for potential future use (e.g. message persistence)
      void sessionId
    },
    [handleWsMessage]
  )

  // ---------------------------------------------------------------------------
  // disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(() => {
    // Stop mic processor
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect()
      micSourceRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Stop audio playback
    stopPlayback()
    agentGainRef.current = null

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Clear analyser state
    setUserAnalyserState(null)
    setAgentAnalyserState(null)

    setIsConnected(false)
    setIsRecording(false)
    setIsSpeaking(false)
    setConversationId(null)
  }, [stopPlayback])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    connect,
    disconnect,
    isConnected,
    isRecording,
    isSpeaking,
    error,
    conversationId,
    userAnalyser: userAnalyserState,
    agentAnalyser: agentAnalyserState,
    onUserTranscript,
    onAgentResponse,
  }
}
