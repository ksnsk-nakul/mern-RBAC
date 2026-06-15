import crypto from 'crypto'
import mongoose from 'mongoose'
import { ApiToken } from '../models/ApiToken.js'
import { NotFoundError } from '../lib/errors.js'

const TOKEN_BYTES  = 32
const TOKEN_PREFIX = 'rbac_'

export interface ApiTokenItem {
  id:         string
  name:       string
  prefix:     string
  scopes:     string[]
  lastUsedAt: string | null
  expiresAt:  string | null
  createdAt:  string
}

export interface CreatedToken extends ApiTokenItem {
  rawToken: string
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export async function createToken(
  userId: mongoose.Types.ObjectId,
  name: string,
  scopes: string[],
  expiresInDays?: number,
): Promise<CreatedToken> {
  const raw       = TOKEN_PREFIX + crypto.randomBytes(TOKEN_BYTES).toString('hex')
  const prefix    = raw.slice(0, TOKEN_PREFIX.length + 8)
  const tokenHash = hashToken(raw)
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : undefined

  const token = await ApiToken.create({ userId, name, tokenHash, prefix, scopes, expiresAt })

  return {
    id:         String(token._id),
    name:       token.name,
    prefix:     token.prefix,
    scopes:     token.scopes,
    lastUsedAt: null,
    expiresAt:  token.expiresAt?.toISOString() ?? null,
    createdAt:  (token as any).createdAt?.toISOString() ?? '',
    rawToken:   raw,
  }
}

export async function listTokens(userId: mongoose.Types.ObjectId): Promise<ApiTokenItem[]> {
  const tokens = await ApiToken.find({ userId, revokedAt: null }).sort({ createdAt: -1 }).lean()
  return tokens.map((t) => ({
    id:         String(t._id),
    name:       t.name,
    prefix:     t.prefix,
    scopes:     t.scopes,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    expiresAt:  t.expiresAt?.toISOString()  ?? null,
    createdAt:  (t as any).createdAt?.toISOString() ?? '',
  }))
}

export async function revokeToken(userId: mongoose.Types.ObjectId, tokenId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(tokenId)) throw new NotFoundError('Token not found or already revoked')
  const result = await ApiToken.updateOne(
    { _id: new mongoose.Types.ObjectId(tokenId), userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  )
  if (result.matchedCount === 0) throw new NotFoundError('Token not found or already revoked')
}

export async function verifyAndLoadToken(
  raw: string,
): Promise<{ userId: mongoose.Types.ObjectId; scopes: string[] } | null> {
  const token = await ApiToken.findOne({
    tokenHash: hashToken(raw),
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
  if (!token) return null

  ApiToken.updateOne({ _id: token._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {})

  return { userId: token.userId, scopes: token.scopes }
}
