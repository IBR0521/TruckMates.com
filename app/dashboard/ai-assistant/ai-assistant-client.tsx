"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
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

export function AiAssistantClient() {
  const [busy, setBusy] = useState(true)
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState("New conversation")
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [enableToolsMode, setEnableToolsMode] = useState(false)
  const [input, setInput] = useState("")
  const [sidebar, setSidebar] = useState<Array<{ id: string; title: string; lastMessageAt: string }>>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const pendingDerived = useMemo(() => derivePendingFromMessages(messages), [messages])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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

  const loadSidebar = useCallback(async () => {
    const list = await getConversations()
    if (list.error) {
      toast.error(list.error)
      return
    }
    setSidebar(
      (list.data || []).map((r) => ({
        id: r.id,
        title: r.title,
        lastMessageAt: r.lastMessageAt,
      })),
    )
  }, [])

  const loadConversation = useCallback(async (id: string) => {
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
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setBusy(true)
      const list = await getConversations()
      if (cancelled) return
      if (list.error) {
        toast.error(list.error)
        setBusy(false)
        return
      }
      const rows = list.data || []
      setSidebar(rows.map((r) => ({ id: r.id, title: r.title, lastMessageAt: r.lastMessageAt })))
      if (rows.length > 0) {
        await loadConversation(rows[0].id)
        return
      }
      const created = await createConversation()
      if (cancelled) return
      if (created.error || !created.data) {
        toast.error(created.error || "Could not start a conversation")
        setBusy(false)
        return
      }
      const newId = created.data.id
      setConversationId(newId)
      setTitle("New conversation")
      setSidebar([{ id: newId, title: "New conversation", lastMessageAt: new Date().toISOString() }])
      const conv = await getConversation(newId)
      if (conv.data) {
        setEnableToolsMode(Boolean(conv.meta?.enableTools))
        setMessages(conv.data.messages.map(mapApiMessage))
      } else {
        setMessages([])
      }
      setBusy(false)
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [loadConversation])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const newConversation = async () => {
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
      await loadSidebar()
      setSidebar((prev) => [
        { id: newId, title: "New conversation", lastMessageAt: new Date().toISOString() },
        ...prev.filter((p) => p.id !== newId),
      ])
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
      await loadSidebar()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[420px] gap-0 border border-border rounded-lg overflow-hidden bg-card">
      <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">Conversations</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void newConversation()} disabled={busy}>
            <Plus className="h-4 w-4 mr-1" aria-hidden />
            New
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <ul className="p-2 space-y-1">
            {sidebar.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void loadConversation(c.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-2 text-sm hover:bg-muted transition",
                    c.id === conversationId ? "bg-muted font-medium" : "text-muted-foreground",
                  )}
                >
                  <span className="line-clamp-2">{c.title || "Conversation"}</span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{title}</h1>
            <p className="text-xs text-muted-foreground">Press ⌘K (Ctrl+K) to focus the input</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Mode:{" "}
              <span className={enableToolsMode ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                {enableToolsMode ? "Actions enabled (Pro+)" : "Read-only answers (Starter)"}
              </span>
            </p>
          </div>
        </header>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-3 max-w-3xl">
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
                    : "mr-8 rounded-lg border border-border bg-background px-3 py-2 text-sm"
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

        <div className="shrink-0 border-t border-border p-3 space-y-3">
          <PendingConfirmationsPanel
            conversationId={conversationId}
            pending={pendingDerived}
            disabled={busy || sending}
            onResolved={refreshConversation}
          />
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
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
      </section>
    </div>
  )
}
