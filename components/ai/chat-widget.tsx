"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, ChevronDown, Loader2, Mic, MicOff, Plus, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getPlanFeatureGate } from "@/app/actions/plan-usage"
import {
  createConversation,
  getConversation,
  getConversations,
  sendChatMessage,
} from "@/app/actions/ai-chat"
import { ChatMarkdown } from "@/components/ai/chat-markdown"
import type { PersistedToolCall, PersistedToolResult } from "@/lib/ai/chat"
import {
  derivePendingFromMessages,
  PendingConfirmationsPanel,
  ToolCallsBadges,
  ToolResultsPreview,
} from "@/components/ai/ai-chat-tool-ui"
import { useVoiceChat } from "@/components/ai/use-voice-chat"
import { isAiChatVoiceEnabled } from "@/lib/ai/voice-chat"

type UiMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls: PersistedToolCall[] | null
  toolResults: PersistedToolResult[] | null
}

function mapApiMessage(m: {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: PersistedToolCall[] | null
  toolResults?: PersistedToolResult[] | null
}): UiMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls ?? null,
    toolResults: m.toolResults ?? null,
  }
}

type StreamOutcome =
  | { ok: true; quotaWarning: boolean; fullText: string }
  | { ok: false; fallback: true }

/**
 * Streams the assistant reply over SSE. Returns `{ ok: false, fallback: true }` whenever the
 * stream cannot be used (tool-eligible turn, network/HTTP error, or an error event) so the caller
 * can fall back to the non-streaming `sendChatMessage` path. Nothing is persisted server-side until
 * a successful stream, so falling back never creates duplicate messages.
 */
async function streamAssistantReply(params: {
  conversationId: string
  message: string
  voiceMode?: boolean
  onDelta: (text: string) => void
}): Promise<StreamOutcome> {
  let response: Response
  try {
    response = await fetch("/api/ai/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: params.conversationId,
        message: params.message,
        voiceMode: Boolean(params.voiceMode),
      }),
    })
  } catch {
    return { ok: false, fallback: true }
  }

  const contentType = response.headers.get("content-type") || ""
  if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
    // Includes the `{ fallback: true }` JSON signal for tool-eligible turns.
    return { ok: false, fallback: true }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let quotaWarning = false
  let sawDone = false
  let fullText = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIndex = buffer.indexOf("\n\n")
      while (sepIndex !== -1) {
        const rawEvent = buffer.slice(0, sepIndex)
        buffer = buffer.slice(sepIndex + 2)
        sepIndex = buffer.indexOf("\n\n")

        const dataStr = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("")
        if (!dataStr) continue

        let evt: { type?: string; text?: string; error?: string; quotaWarning?: boolean }
        try {
          evt = JSON.parse(dataStr)
        } catch {
          continue
        }

        if (evt.type === "delta" && typeof evt.text === "string") {
          fullText += evt.text
          params.onDelta(evt.text)
        } else if (evt.type === "done") {
          quotaWarning = Boolean(evt.quotaWarning)
          sawDone = true
        } else if (evt.type === "error") {
          return { ok: false, fallback: true }
        }
      }
    }
  } catch {
    return { ok: false, fallback: true }
  }

  if (!sawDone) return { ok: false, fallback: true }
  return { ok: true, quotaWarning, fullText }
}

export function AiChatWidget() {
  const voiceFeatureEnabled = isAiChatVoiceEnabled()
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState("New conversation")
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [enableToolsMode, setEnableToolsMode] = useState(false)
  const [actionsModeLabel, setActionsModeLabel] = useState("Read-only answers")
  const [input, setInput] = useState("")
  const [recent, setRecent] = useState<Array<{ id: string; title: string }>>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const pendingDerived = useMemo(() => derivePendingFromMessages(messages), [messages])

  useEffect(() => {
    let active = true
    getPlanFeatureGate("ai_chat")
      .then((res) => {
        if (!active) return
        setEligible(Boolean(res.data?.allowed))
      })
      .catch(() => {
        if (active) setEligible(false)
      })
    return () => {
      active = false
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, open, scrollToBottom])

  const refreshConversation = useCallback(async () => {
    if (!conversationId) return
    const conv = await getConversation(conversationId)
    if (conv.error || !conv.data) {
      toast.error(conv.error || "Could not refresh conversation")
      return
    }
    setTitle(conv.data.title)
    setEnableToolsMode(Boolean(conv.meta?.enableTools))
    setActionsModeLabel(conv.meta?.actionsModeLabel || (conv.meta?.enableTools ? "Actions enabled" : "Read-only answers"))
    setMessages(conv.data.messages.map(mapApiMessage))
  }, [conversationId])

  const bootstrapConversation = useCallback(async () => {
    setBusy(true)
    try {
      const list = await getConversations()
      if (list.error) {
        toast.error(list.error)
        return
      }
      const rows = list.data || []
      setRecent(rows.map((r) => ({ id: r.id, title: r.title })))
      if (rows.length > 0) {
        const first = rows[0]
        setConversationId(first.id)
        setTitle(first.title)
        const conv = await getConversation(first.id)
        if (conv.error || !conv.data) {
          toast.error(conv.error || "Could not load conversation")
          return
        }
        setEnableToolsMode(Boolean(conv.meta?.enableTools))
    setActionsModeLabel(conv.meta?.actionsModeLabel || (conv.meta?.enableTools ? "Actions enabled" : "Read-only answers"))
        setMessages(conv.data.messages.map(mapApiMessage))
        return
      }
      const created = await createConversation()
      if (created.error || !created.data) {
        toast.error(created.error || "Could not start a conversation")
        return
      }
      const newId = created.data.id
      setConversationId(newId)
      setTitle("New conversation")
      setRecent([{ id: newId, title: "New conversation" }])
      const conv = await getConversation(newId)
      if (conv.data) {
        setEnableToolsMode(Boolean(conv.meta?.enableTools))
    setActionsModeLabel(conv.meta?.actionsModeLabel || (conv.meta?.enableTools ? "Actions enabled" : "Read-only answers"))
        setMessages(conv.data.messages.map(mapApiMessage))
      } else {
        setMessages([])
        setEnableToolsMode(false)
        setActionsModeLabel("Read-only answers")
      }
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void bootstrapConversation()
  }, [open, bootstrapConversation])

  const startNewConversation = async () => {
    setBusy(true)
    try {
      const created = await createConversation()
      if (created.error || !created.data) {
        toast.error(created.error || "Could not start a conversation")
        return
      }
      const newId = created.data.id
      setConversationId(newId)
      setTitle("New conversation")
      setRecent((prev) => [{ id: newId, title: "New conversation" }, ...prev.filter((p) => p.id !== newId)])
      const conv = await getConversation(newId)
      if (conv.data) {
        setEnableToolsMode(Boolean(conv.meta?.enableTools))
    setActionsModeLabel(conv.meta?.actionsModeLabel || (conv.meta?.enableTools ? "Actions enabled" : "Read-only answers"))
        setMessages(conv.data.messages.map(mapApiMessage))
      } else {
        setMessages([])
      }
    } finally {
      setBusy(false)
    }
  }

  const switchConversation = async (id: string) => {
    setBusy(true)
    try {
      setConversationId(id)
      const conv = await getConversation(id)
      if (conv.error || !conv.data) {
        toast.error(conv.error || "Could not load conversation")
        return
      }
      setTitle(conv.data.title)
      setEnableToolsMode(Boolean(conv.meta?.enableTools))
    setActionsModeLabel(conv.meta?.actionsModeLabel || (conv.meta?.enableTools ? "Actions enabled" : "Read-only answers"))
      setMessages(conv.data.messages.map(mapApiMessage))
    } finally {
      setBusy(false)
    }
  }

  const refreshRecents = useCallback(async () => {
    const again = await getConversations()
    if (again.data) {
      setRecent(again.data.map((r) => ({ id: r.id, title: r.title })))
    }
  }, [])

  const sendNonStreaming = useCallback(
    async (convId: string, text: string, voiceMode = false): Promise<string | null> => {
      const res = await sendChatMessage({ conversationId: convId, message: text, voiceMode })
      if (res.error || !res.data) {
        toast.error(res.error || "Send failed")
        await refreshConversation()
        return null
      }
      if (res.quotaWarning) {
        toast.message("You are approaching your monthly AI usage limit.")
      }
      setEnableToolsMode(Boolean(res.data.enableTools))
      setActionsModeLabel(res.data.actionsModeLabel || (res.data.enableTools ? "Actions enabled" : "Read-only answers"))
      await refreshConversation()
      await refreshRecents()
      return res.data.assistantContent
    },
    [refreshConversation, refreshRecents],
  )

  const sendMessageRef = useRef<(text: string, voiceMode?: boolean) => Promise<void>>(async () => {})

  const voice = useVoiceChat({
    onFinalTranscript: (transcript) => {
      void sendMessageRef.current(transcript, true)
    },
    onInterimTranscript: (interim) => setInput(interim),
    onError: (msg) => toast.message(msg),
  })

  const showVoiceControls =
    voiceFeatureEnabled && (voice.recognitionSupported || voice.synthesisSupported)

  const sendMessage = useCallback(
    async (rawText: string, voiceMode = false) => {
      const text = rawText.trim()
      if (!text || !conversationId) return
      const convId = conversationId
      voice.stopSpeaking()
      setSending(true)
      setInput("")

      const tempUserId = `temp-user-${Date.now()}`
      const tempAsstId = `temp-asst-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        { id: tempUserId, role: "user", content: text, toolCalls: null, toolResults: null },
        { id: tempAsstId, role: "assistant", content: "", toolCalls: null, toolResults: null },
      ])

      try {
        const streamed = await streamAssistantReply({
          conversationId: convId,
          message: text,
          voiceMode,
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempAsstId ? { ...m, content: m.content + delta } : m)),
            )
          },
        })

        if (streamed.ok) {
          if (streamed.quotaWarning) {
            toast.message("You are approaching your monthly AI usage limit.")
          }
          await refreshConversation()
          await refreshRecents()
          if (voiceMode && voice.readAloudEnabled && voice.synthesisSupported && streamed.fullText.trim()) {
            voice.speak(streamed.fullText)
          }
          return
        }

        setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAsstId))
        const assistantContent = await sendNonStreaming(convId, text, voiceMode)
        if (
          voiceMode &&
          voice.readAloudEnabled &&
          voice.synthesisSupported &&
          assistantContent?.trim()
        ) {
          voice.speak(assistantContent)
        }
      } finally {
        setSending(false)
      }
    },
    [
      conversationId,
      refreshConversation,
      refreshRecents,
      sendNonStreaming,
      voice.readAloudEnabled,
      voice.synthesisSupported,
      voice.speak,
      voice.stopSpeaking,
    ],
  )

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const handleSend = () => {
    void sendMessage(input, false)
  }

  if (eligible !== true) {
    return null
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-7 w-7" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[450px] flex flex-col p-0 gap-0">
          <SheetHeader className="border-b border-border px-4 py-3 space-y-0 shrink-0">
            <SheetDescription className="sr-only">
              Ask TruckMates AI about your fleet, drivers, loads, finances, compliance, and maintenance. Your messages
              are saved to this conversation.
            </SheetDescription>
            <div className="flex items-start justify-between gap-2 pr-8">
              <SheetTitle className="text-left text-base leading-tight line-clamp-2">{title}</SheetTitle>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Mode:{" "}
              <span className={enableToolsMode ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                {actionsModeLabel}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void startNewConversation()} disabled={busy}>
                <Plus className="h-4 w-4 mr-1" aria-hidden />
                New
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" disabled={busy || recent.length === 0}>
                    Recent
                    <ChevronDown className="h-4 w-4 ml-1" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                  {recent.map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => void switchConversation(c.id)}>
                      <span className="line-clamp-1">{c.title || "Conversation"}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0 px-4">
            <div className="py-3 space-y-3">
              {busy && messages.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : null}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-8 rounded-lg bg-muted px-3 py-2 text-sm"
                      : "mr-6 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  }
                >
                  {m.role === "assistant" ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {m.content.trim() ? <ChatMarkdown content={m.content} /> : null}
                          {m.toolCalls?.length ? <ToolCallsBadges calls={m.toolCalls} /> : null}
                          {m.toolResults?.length ? <ToolResultsPreview results={m.toolResults} /> : null}
                        </div>
                        {showVoiceControls && voice.synthesisSupported && m.content.trim() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label="Read answer aloud"
                            title="Read answer aloud"
                            disabled={voice.speaking || sending}
                            onClick={() => voice.speak(m.content)}
                          >
                            <Volume2 className="h-4 w-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border px-4 pt-3 shrink-0 space-y-3">
            <PendingConfirmationsPanel
              conversationId={conversationId}
              pending={pendingDerived}
              disabled={busy || sending}
              onResolved={refreshConversation}
            />
            {showVoiceControls && voice.synthesisSupported ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ai-chat-read-aloud"
                  checked={voice.readAloudEnabled}
                  onCheckedChange={(checked) => voice.setReadAloudEnabled(checked === true)}
                  disabled={sending || busy}
                />
                <Label htmlFor="ai-chat-read-aloud" className="text-[11px] text-muted-foreground font-normal">
                  Read replies aloud after voice input
                </Label>
              </div>
            ) : null}
            {voiceFeatureEnabled && !voice.recognitionSupported && !voice.synthesisSupported ? (
              <p className="text-[11px] text-muted-foreground">
                Voice input/output is not available in this browser. Type your message below.
              </p>
            ) : null}
            <div className="flex gap-2 pb-3">
              {showVoiceControls && voice.recognitionSupported ? (
                <Button
                  type="button"
                  variant={voice.listening ? "destructive" : "outline"}
                  size="icon"
                  className="shrink-0"
                  aria-label={voice.listening ? "Stop voice input" : "Voice input — speak your question"}
                  title={voice.listening ? "Stop listening" : "Voice input"}
                  disabled={sending || busy || !conversationId}
                  onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
                >
                  {voice.listening ? (
                    <MicOff className="h-4 w-4 animate-pulse" aria-hidden />
                  ) : (
                    <Mic className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              ) : null}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  voice.listening ? "Listening… speak your question" : "Ask about loads, drivers, HOS, billing…"
                }
                disabled={sending || busy || !conversationId || voice.listening}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button type="button" onClick={handleSend} disabled={sending || busy || !conversationId || voice.listening}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Send"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
