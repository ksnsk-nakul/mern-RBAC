import { Router, type Request, type Response } from 'express'
import mongoose from 'mongoose'
import { authenticate } from '../middleware/authenticate.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const AI_BASE = process.env.AI_SERVICE_URL ?? 'http://localhost:8001'

export const aiRouter = Router()

aiRouter.use(authenticate)

async function proxyJson(url: string, init: RequestInit, res: Response) {
  const upstream = await fetch(url, init)
  const body = await upstream.json() as unknown
  res.status(upstream.status).json(body)
}

// GET /ai/conversations — list user's conversations
aiRouter.get('/conversations', async (req: Request, res: Response) => {
  const { userId } = req.user as unknown as AuthUser
  await proxyJson(`${AI_BASE}/conversations/${String(userId)}`, { method: 'GET' }, res)
})

// POST /ai/conversations — create new conversation
aiRouter.post('/conversations', async (req: Request, res: Response) => {
  const { userId } = req.user as unknown as AuthUser
  await proxyJson(`${AI_BASE}/conversations`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId: String(userId), title: (req.body as { title?: string }).title }),
  }, res)
})

// GET /ai/conversations/:id — get conversation detail
aiRouter.get('/conversations/:id', async (req: Request, res: Response) => {
  await proxyJson(`${AI_BASE}/conversations/${req.params.id}/detail`, { method: 'GET' }, res)
})

// DELETE /ai/conversations/:id — delete conversation
aiRouter.delete('/conversations/:id', async (req: Request, res: Response) => {
  const upstream = await fetch(`${AI_BASE}/conversations/${req.params.id}`, { method: 'DELETE' })
  res.status(upstream.status).send()
})

// POST /ai/conversations/:id/chat — stream chat response
aiRouter.post('/conversations/:id/chat', async (req: Request, res: Response) => {
  const upstream = await fetch(`${AI_BASE}/conversations/${req.params.id}/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: (req.body as { message: string }).message }),
  })

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text()
    return res.status(upstream.status).json({ error: err })
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Transfer-Encoding', 'chunked')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  const reader  = upstream.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    void res.write(decoder.decode(value, { stream: true }))
  }
  res.end()
})
