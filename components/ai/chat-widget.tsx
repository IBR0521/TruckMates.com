"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, ChevronDown, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

export function AiChatWidget() {
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState("New conversation")
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [enableToolsMode, setEnableToolsMode] = useState(false)
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
        setMessages(conv.data.messages.map(mapApiMessage))
      } else {
        setMessages([])
        setEnableToolsMode(false)
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
      setMessages(conv.data.messages.map(mapApiMessage))
    } finally {
      setBusy(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !conversationId) return
    setSending(true)
    setInput("")
    try {
      const res = await sendChatMessage({ conversationId, message: text })
      if (res.error || !res.data) {
        toast.error(res.error || "Send failed")
        await refreshConversation()
        return
      }
      if (res.quotaWarning) {
        toast.message("You are approaching your monthly AI usage limit.")
      }
      setEnableToolsMode(Boolean(res.data.enableTools))
      await refreshConversation()
      const again = await getConversations()
      if (again.data) {
        setRecent(again.data.map((r) => ({ id: r.id, title: r.title })))
      }
    } finally {
      setSending(false)
    }
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
                {enableToolsMode ? "Actions enabled (Pro+)" : "Read-only answers (Starter)"}
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
                      {m.content.trim() ? <ChatMarkdown content={m.content} /> : null}
                      {m.toolCalls?.length ? <ToolCallsBadges calls={m.toolCalls} /> : null}
                      {m.toolResults?.length ? <ToolResultsPreview results={m.toolResults} /> : null}
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
            <div className="flex gap-2 pb-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about loads, drivers, HOS, billing…"
                disabled={sending || busy || !conversationId}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
              />
              <Button type="button" onClick={() => void handleSend()} disabled={sending || busy || !conversationId}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Send"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
