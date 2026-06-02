"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  prepareTextForSpeech,
} from "@/lib/ai/voice-chat"
import type { SpeechRecognitionInstance } from "@/lib/ai/speech-recognition-types"

export type VoiceChatState = {
  /** Browser supports SpeechRecognition (or webkit prefix). */
  recognitionSupported: boolean
  /** Browser supports SpeechSynthesis. */
  synthesisSupported: boolean
  listening: boolean
  /** When true, assistant replies are read aloud after voice sends. */
  readAloudEnabled: boolean
  setReadAloudEnabled: (v: boolean) => void
  /** Start mic capture; calls onFinalTranscript when the user finishes a phrase. */
  startListening: () => void
  stopListening: () => void
  /** Read text aloud (no-op when synthesis unsupported). */
  speak: (text: string) => void
  stopSpeaking: () => void
  speaking: boolean
}

export function useVoiceChat(params: {
  onFinalTranscript: (text: string) => void
  onInterimTranscript?: (text: string) => void
  onError?: (message: string) => void
}): VoiceChatState {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [readAloudEnabled, setReadAloudEnabled] = useState(true)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onFinalRef = useRef(params.onFinalTranscript)
  const onInterimRef = useRef(params.onInterimTranscript)
  const onErrorRef = useRef(params.onError)

  useEffect(() => {
    onFinalRef.current = params.onFinalTranscript
    onInterimRef.current = params.onInterimTranscript
    onErrorRef.current = params.onError
  }, [params.onFinalTranscript, params.onInterimTranscript, params.onError])

  const recognitionSupported = isSpeechRecognitionSupported()
  const synthesisSupported = isSpeechSynthesisSupported()

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!synthesisSupported) return
      const utteranceText = prepareTextForSpeech(text)
      if (!utteranceText) return

      stopSpeaking()
      const utterance = new SpeechSynthesisUtterance(utteranceText)
      utterance.rate = 1.05
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
    },
    [stopSpeaking, synthesisSupported],
  )

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) {
      try {
        rec.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      onErrorRef.current?.("Voice input is not supported in this browser.")
      return
    }

    stopSpeaking()
    stopListening()

    const rec = new Ctor()
    recognitionRef.current = rec
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US"
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interim = ""
      let finalText = ""
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript || ""
        if (result.isFinal) finalText += transcript
        else interim += transcript
      }
      if (finalText.trim()) {
        stopListening()
        onFinalRef.current(finalText.trim())
      } else if (interim.trim()) {
        onInterimRef.current?.(interim.trim())
      }
    }

    rec.onerror = (event) => {
      stopListening()
      if (event.error === "aborted" || event.error === "no-speech") return
      onErrorRef.current?.(
        event.error === "not-allowed"
          ? "Microphone permission denied. Allow mic access in browser settings."
          : "Voice input failed. Try again or type your message.",
      )
    }

    rec.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    try {
      rec.start()
      setListening(true)
    } catch {
      stopListening()
      onErrorRef.current?.("Could not start voice input.")
    }
  }, [stopListening, stopSpeaking])

  useEffect(() => {
    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [stopListening, stopSpeaking])

  return {
    recognitionSupported,
    synthesisSupported,
    listening,
    readAloudEnabled,
    setReadAloudEnabled,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    speaking,
  }
}
