import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'

interface Conversation {
  id:        string
  title:     string
  updatedAt: string
}

interface Message {
  id:      string
  role:    'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId,      setActiveId]      = useState<string | null>(null)
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [streaming,     setStreaming]      = useState(false)
  const [streamBuffer,  setStreamBuffer]  = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    const { data } = await api.get<Conversation[]>('/ai/conversations')
    setConversations(data)
  }, [])

  useEffect(() => { void loadConversations() }, [loadConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamBuffer])

  async function openConversation(id: string) {
    setActiveId(id)
    setStreamBuffer('')
    const { data } = await api.get<{ messages: Message[] }>(`/ai/conversations/${id}`)
    setMessages(data.messages)
  }

  async function newConversation() {
    const { data } = await api.post<{ id: string }>('/ai/conversations', { title: 'New conversation' })
    await loadConversations()
    await openConversation(data.id)
  }

  async function deleteConversation(id: string) {
    await api.delete(`/ai/conversations/${id}`)
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
    }
    await loadConversations()
  }

  async function sendMessage() {
    if (!input.trim() || !activeId || streaming) return
    const text = input.trim()
    setInput('')
    setStreaming(true)
    setStreamBuffer('')

    // Optimistically add user message
    const tempUserMsg: Message = { id: `temp-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const token = localStorage.getItem('token') ?? ''
      const response = await fetch(`/api/ai/conversations/${activeId}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: text }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Stream failed')
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamBuffer(full)
      }

      setStreamBuffer('')
      setMessages((prev) => [
        ...prev,
        { id: `asst-${Date.now()}`, role: 'assistant', content: full },
      ])

      await loadConversations()
    } catch {
      setStreamBuffer('')
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Error: could not get response.' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 rounded-xl border overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <Button size="sm" className="w-full" onClick={() => void newConversation()}>+ New chat</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <div key={c.id}
              className={`group flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-accent transition-colors text-sm ${activeId === c.id ? 'bg-accent font-medium' : ''}`}
              onClick={() => void openConversation(c.id)}>
              <span className="flex-1 truncate">{c.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs"
                onClick={(e) => { e.stopPropagation(); void deleteConversation(c.id) }}>
                ✕
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">No chats yet.</p>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select or start a conversation.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[--role-accent] text-white rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {streamBuffer && (
                <div className="flex justify-start">
                  <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap bg-muted rounded-bl-sm">
                    {streamBuffer}
                    <span className="animate-pulse">▌</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void sendMessage()}
                disabled={streaming}
                className="flex-1"
              />
              <Button size="sm" onClick={() => void sendMessage()} disabled={streaming || !input.trim()}>
                {streaming ? '…' : 'Send'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
