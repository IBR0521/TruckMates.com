"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

type UiMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

export function AiChatWidget() {
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [title, setTitle] = useState("New conversation")
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState("")
  const [recent, setRecent] = useState<Array<{ id: string; title: string }>>([])
  const bottomRef = useRef<HTMLDivElement | null>(null)

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
        setMessages(
          conv.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        )
        return
      }
      const created = await createConversation()
      if (created.error || !created.data) {
        toast.error(created.error || "Could not start a conversation")
        return
      }
      setConversationId(created.data.id)
      setTitle("New conversation")
      setMessages([])
      setRecent([{ id: created.data.id, title: "New conversation" }])
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
      setMessages([])
      setRecent((prev) => [{ id: newId, title: "New conversation" }, ...prev.filter((p) => p.id !== newId)])
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
      setMessages(
        conv.data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })),
      )
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
        const partial = await getConversation(conversationId)
        if (partial.data) {
          setMessages(
            partial.data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            })),
          )
        }
        return
      }
      if (res.quotaWarning) {
        toast.message("You are approaching your monthly AI usage limit.")
      }
      const refreshed = await getConversation(conversationId)
      if (refreshed.data) {
        setTitle(refreshed.data.title)
        setMessages(
          refreshed.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        )
      }
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
                  {m.role === "assistant" ? <ChatMarkdown content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3 shrink-0 flex gap-2">
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
        </SheetContent>
      </Sheet>
    </>
  )
}
