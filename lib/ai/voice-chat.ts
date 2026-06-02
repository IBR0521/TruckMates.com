/**
 * Browser speech utilities for hands-busy AI chat (SpeechRecognition + SpeechSynthesis).
 * Client-only — guard with typeof window before calling.
 */

import type { SpeechRecognitionCtor } from "@/lib/ai/speech-recognition-types"

/** Feature flag: set NEXT_PUBLIC_AI_CHAT_VOICE=true to show voice controls in the chat widget. */
export function isAiChatVoiceEnabled(): boolean {
  const v = String(process.env.NEXT_PUBLIC_AI_CHAT_VOICE || "").trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

/** Max characters read aloud — keeps TTS practical while driving/dispatching. */
export const VOICE_TTS_MAX_CHARS = 600

export type { SpeechRecognitionCtor } from "@/lib/ai/speech-recognition-types"

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

/** Strip markdown/noise so TTS reads naturally. */
export function prepareTextForSpeech(raw: string): string {
  let text = String(raw || "").trim()
  if (!text) return ""

  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (text.length > VOICE_TTS_MAX_CHARS) {
    const cut = text.slice(0, VOICE_TTS_MAX_CHARS)
    const lastPeriod = cut.lastIndexOf(". ")
    const spoken = lastPeriod > 120 ? cut.slice(0, lastPeriod + 1) : cut
    return `${spoken.trim()} … Full answer is in the chat.`
  }
  return text
}

/** Extra instruction appended server-side when the user sent via voice input. */
export const VOICE_BREVITY_HINT =
  "The user is using voice mode while busy. Reply in 2–4 short spoken sentences max. No markdown tables, bullet lists, or long enumerations — dispatchers are busy."
