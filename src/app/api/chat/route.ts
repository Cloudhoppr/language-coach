import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getGeminiClient } from '@/lib/gemini'
import { TextChatRequestSchema } from '@/lib/schemas'
import { COACH_SYSTEM_PROMPT } from '@/lib/constants'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = TextChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten() }, { status: 400 })
  }

  const { session_id, message } = parsed.data
  const supabase = createServerSupabase()

  // 1. Fetch existing messages for context
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at')

  // 2. Build Gemini conversation contents
  const ai = getGeminiClient()
  const contents = (history || []).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: m.content as string }],
  }))
  contents.push({ role: 'user', parts: [{ text: message }] })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: COACH_SYSTEM_PROMPT,
      temperature: 0.7,
    },
  })

  const reply = response.text || ''

  // 3. Store both messages
  await supabase
    .from('messages')
    .insert({ session_id, role: 'user', content: message })

  const { data: assistantMsg } = await supabase
    .from('messages')
    .insert({ session_id, role: 'assistant', content: reply })
    .select()
    .single()

  // 4. Update session timestamp
  await supabase
    .from('sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', session_id)

  return NextResponse.json({
    reply,
    audio_url: null,
    message_id: assistantMsg?.id || '',
  })
}
