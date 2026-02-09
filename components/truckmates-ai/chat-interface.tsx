"use client"

/**
 * TruckMates AI Chat Interface
 * Professional, modern chat interface with streaming responses
 */

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Loader2, Send, Bot, User, Sparkles, Copy, Check, Zap, Scale, BarChart3, Truck, Zap as Lightning, XCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  actions?: Array<{ function: string; result: any; error?: string }>
  timestamp: Date
  isStreaming?: boolean
}

interface ChatInterfaceProps {
  threadId?: string
  className?: string
}

// Format markdown to HTML (simple implementation)
function formatMarkdown(text: string): string {
  let html = text
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-foreground">$1</strong>')
    // Code inline
    .replace(/`([^`]+)`/gim, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mb-2 mt-3 first:mt-0">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mb-2 mt-3 first:mt-0">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mb-2 mt-4 first:mt-0">$1</h1>')
  
  // Handle lists
  const lines = html.split('\n')
  let inList = false
  let result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isListItem = /^[\*\-\+] (.+)$/.test(line)
    
    if (isListItem) {
      if (!inList) {
        result.push('<ul class="list-disc list-inside mb-3 space-y-1">')
        inList = true
      }
      const content = line.replace(/^[\*\-\+] (.+)$/, '$1')
      result.push(`<li class="leading-relaxed">${content}</li>`)
    } else {
      if (inList) {
        result.push('</ul>')
        inList = false
      }
      if (line.trim()) {
        result.push(`<p class="mb-3 last:mb-0 leading-relaxed">${line}</p>`)
      }
    }
  }
  
  if (inList) {
    result.push('</ul>')
  }
  
  return result.join('\n')
}

export function TruckMatesAIChat({ threadId, className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    
    // Add user message
    const userMessageId = `user-${Date.now()}`
    const newUserMessage: Message = {
      id: userMessageId,
      role: "user",
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newUserMessage])
    setIsLoading(true)

    // Create streaming message placeholder
    const assistantMessageId = `assistant-${Date.now()}`
    const streamingMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true
    }
    setMessages(prev => [...prev, streamingMessage])
    setStreamingMessageId(assistantMessageId)

    try {
      // Build conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Call AI API (streaming for better UX)
      const response = await fetch("/api/truckmates-ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
          threadId: threadId || "default",
          stream: true
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""
      let actions: any[] = []

      if (reader && response.headers.get('content-type')?.includes('text/event-stream')) {
        // Streaming response
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.content) {
                  accumulatedContent += data.content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ))
                }
                
                if (data.actions) {
                  actions = data.actions
                }
                
                if (data.done) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false, actions }
                      : msg
                  ))
                  setStreamingMessageId(null)
                  
                  if (actions.length > 0) {
                    const successful = actions.filter((a: any) => !a.error)
                    const failed = actions.filter((a: any) => a.error)
                    if (successful.length > 0) {
                      toast.success(`Executed ${successful.length} action(s)`)
                    }
                    if (failed.length > 0) {
                      toast.error(`${failed.length} action(s) failed`)
                    }
                  }
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } else {
        // Fallback to non-streaming
        const data = await response.json()
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, content: data.response || "I'm sorry, I couldn't generate a response.", isStreaming: false, actions: data.actions }
            : msg
        ))
        setStreamingMessageId(null)
        
        if (data.actions && data.actions.length > 0) {
          const successful = data.actions.filter((a: any) => !a.error)
          const failed = data.actions.filter((a: any) => a.error)
          if (successful.length > 0) {
            toast.success(`Executed ${successful.length} action(s)`)
          }
          if (failed.length > 0) {
            toast.error(`${failed.length} action(s) failed`)
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
        return
      }
      
      console.error("Chat error:", error)
      toast.error(error.message || "Failed to get AI response")
      
      // Update error message
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, content: `I'm sorry, I encountered an error: ${error.message || "Unknown error"}. Please try again.`, isStreaming: false }
          : msg
      ))
      setStreamingMessageId(null)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleCopy = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(messageId)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header - Premium Design */}
      <div className="p-4 border-b bg-card/50">
      </div>

      {/* Messages - Premium Chat UI */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-2xl opacity-20"></div>
              <div className="relative p-6 bg-primary rounded-2xl shadow-2xl">
                <Sparkles className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground max-w-lg">
              Ask me anything about regulations, operations, or your fleet.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-4 group",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
            )}
            
            <div
              className={cn(
                "max-w-[85%] md:max-w-[75%] rounded-2xl shadow-sm transition-all",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/50"
              )}
            >
              <div className="p-5">
                {message.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div 
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ 
                        __html: formatMarkdown(message.content) 
                      }}
                    />
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse"></span>
                    )}
                  </div>
                ) : (
                  <div className="text-white leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}
                
                {/* Show actions if any */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="text-xs font-semibold mb-2 text-muted-foreground">Actions Executed:</div>
                    <div className="space-y-2">
                      {message.actions.map((action, actionIndex) => (
                        <div
                          key={actionIndex}
                          className={cn(
                            "text-xs p-2.5 rounded-lg border",
                            action.error
                              ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                              : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400"
                          )}
                        >
                          <div className="font-semibold flex items-center gap-2">
                            {action.error ? (
                              <XCircle className="w-4 h-4 text-red-600" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            )}
                            <span className="font-mono">{action.function}</span>
                          </div>
                          {action.error && (
                            <div className="mt-1.5 text-xs opacity-80">{action.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Footer with timestamp and copy */}
              <div className="px-5 pb-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {message.role === "assistant" && (
                  <button
                    onClick={() => handleCopy(message.id, message.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded"
                    title="Copy message"
                  >
                    {copiedMessageId === message.id ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {message.role === "user" && (
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && !streamingMessageId && (
          <div className="flex gap-4 justify-start">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Analyzing your request...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - Premium Design */}
      <div className="p-6 border-t bg-background">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask TruckMates AI anything about logistics, regulations, or your fleet..."
              disabled={isLoading}
              className="min-h-[52px] pr-12 text-base border-2 focus:border-primary rounded-xl shadow-sm"
            />
            {input.trim() && (
              <button
                onClick={() => setInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="lg"
            className="h-[52px] px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                <span>Send</span>
              </>
            )}
          </Button>
        </div>
        {isLoading && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => abortControllerRef.current?.abort()}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

