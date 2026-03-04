## Inspiration

Most language learning apps teach you to read a language. A select few teach you to write it. But virtually none teach you the one skill that actually matters when you're standing in a market in Mexico City trying to ask where the bathroom is: speaking it.
The dirty secret of mainstream language apps is that they're built around text. Flashcards, fill-in-the-blank, grammar drills — all optimized for the keyboard, not the vocal cords. Real conversational fluency demands something different: the ability to hear authentic pronunciation, to process and respond in real time, to practice the rhythm and cadence of a living language. Voice input isn't a feature — it's the whole ballgame. And it's been absent from nearly every language learning app on the market.
We built HablaConmigo to fix that.


## What It Does

Hablo is a voice-first AI language coach for English speakers learning Mexican Spanish. Not Castilian Spanish. Not "generic Latin American" Spanish. Mexican Spanish — with the vocabulary, slang, and cultural nuances you'd actually encounter.
The experience is simple: you click a microphone, and you're in a conversation. The AI coach greets you, gauges your proficiency in the first few exchanges, and immediately personalizes the session to your level. Beginners get English-heavy guidance with Spanish vocabulary woven in. Intermediate learners get a code-switching mix that mirrors real bilingual conversations. Advanced users get the full immersion treatment — the coach speaks primarily in Mexican Spanish and only dips into English for nuanced grammar corrections.
You can speak back, or type if you prefer. Either way, the coach responds intelligently, corrects your mistakes conversationally (not clinically), and keeps the dialogue flowing naturally. A live dual-channel waveform visualizer pulses with both your voice and the coach's — a constant visual reminder that this is a real, live exchange. Every session is persisted, browsable, and replayable in full transcript.


## How We Built It: The ElevenLabs Integration

The entire voice experience is powered by ElevenLabs Conversational AI, and it's worth unpacking how deeply it's woven into the architecture — because this isn't a "bolt-on TTS" integration.
When a user clicks the mic button, a signed URL handshake occurs: the Next.js server proxies a request to the ElevenLabs API to mint a short-lived, cryptographically signed WebSocket URL. This is a deliberate security choice — the API key never touches the browser. The client then opens a direct WebSocket to ElevenLabs' infrastructure.
From there, the pipeline is continuous and real-time:
1. Microphone → STT: The Web Audio API captures raw mic input. A ScriptProcessorNode downsamples it from the native rate (44.1kHz) to the 16kHz PCM format ElevenLabs expects, converts it to 16-bit integers, base64-encodes it, and streams it over the WebSocket as user_audio_chunk events. Crucially, the mic is gated to a half-duplex turn-taking model — it only transmits when it's the user's turn to speak, mirroring the natural rhythm of conversation.
2. ElevenLabs Agent Pipeline: On ElevenLabs' servers, the audio is transcribed, routed through Gemini 2.5 Flash (the configured LLM for the agent), and synthesized back to audio with the Multilingual v2 voice model — which handles the Spanish phonemes and prosody correctly.
3. Audio → Browser: The coach's audio streams back as base64-encoded chunks via WebSocket audio events. These are decoded via the Web Audio API, queued as AudioBufferSourceNodes, and played back gaplessly. When the queue drains, the mic reopens for the user's next turn.
4. Live Transcript: ElevenLabs sends user_transcript and agent_response events in parallel with the audio, populating a real-time scrolling chat transcript — so the exchange feels like iMessage, not a terminal.
5. Interruption Handling: If the user speaks while the coach is talking, ElevenLabs fires an interruption event and all queued audio is immediately cleared — natural, human-like conversation flow, not robotic turn-waiting.


## Architecture Overview

HablaConmigo is a unified Next.js 15 App Router application — no separate backend, no microservices. All server-side logic lives in Next.js Route Handlers, which act as a secure API layer between the browser and external services.
- Frontend: React with TypeScript, Tailwind CSS v4 (CSS @theme-based, no config file), Zustand for state management, Zod for runtime validation
- Voice AI: ElevenLabs Conversational AI (WebSocket, real-time STT + TTS + agent pipeline)
- LLM: Google Gemini 2.5 Flash for the coaching intelligence — accessed via ElevenLabs' agent configuration for voice mode, and directly via @google/genai for text mode and auto-generated session titles
- Database: Supabase (PostgreSQL) for session and message persistence, with RLS policies separating browser-safe anon access from server-side writes
- Security: All API keys (ELEVENLABS_API_KEY, GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY) are exclusively server-side. The browser holds only a short-lived signed URL and the Supabase anon key
The core voice hook (use-conversation.ts) is the most complex piece — 442 lines managing the full WebSocket lifecycle, the Web Audio pipeline, turn-taking state, audio queuing, waveform analyser nodes, and Supabase persistence — all in a single, clean React hook.


## What's Next

The foundation is solid and the core loop is working. On the roadmap: a Three.js 3D waveform visualizer to replace the 2D canvas bars, a post-session AI feedback analysis powered by Gemini that scores grammar, vocabulary, and pronunciation across the full session transcript, and a production deployment to Vercel.
The goal isn't to build another language app. It's to build the language coach that most people never had access to — patient, personalized, and always ready to talk.
