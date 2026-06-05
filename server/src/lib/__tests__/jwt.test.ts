import { describe, it, expect, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

// Set env vars before importing module under test
process.env.JWT_ACCESS_SECRET  = 'test_access_secret_that_is_at_least_32_chars_long'
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_that_is_at_least_32_chars_long'
process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64)
process.env.MONGODB_URI = 'mongodb://localhost:27017/test'

const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken, ACCESS_TTL_MS, REFRESH_TTL_MS } =
  await import('../jwt.js')

describe('signAccessToken', () => {
  it('returns a valid JWT string', () => {
    const token = signAccessToken({ sub: 'user1', roleId: 'role1', permissions: ['users.view'] })
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('payload contains sub, roleId, and permissions', () => {
    const token = signAccessToken({ sub: 'user1', roleId: 'role1', permissions: ['users.view', 'roles.manage'] })
    const decoded = jwt.decode(token) as any
    expect(decoded.sub).toBe('user1')
    expect(decoded.roleId).toBe('role1')
    expect(decoded.permissions).toEqual(['users.view', 'roles.manage'])
  })

  it('token expires in roughly 15 minutes', () => {
    const before = Math.floor(Date.now() / 1000)
    const token  = signAccessToken({ sub: 'u', roleId: 'r', permissions: [] })
    const decoded = jwt.decode(token) as any
    const expectedExp = before + 15 * 60
    expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 2)
    expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 2)
  })
})

describe('signRefreshToken', () => {
  it('returns a valid JWT string', () => {
    const token = signRefreshToken({ sub: 'user1', roleId: 'role1' })
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('payload contains sub and roleId', () => {
    const token   = signRefreshToken({ sub: 'user2', roleId: 'role2' })
    const decoded = jwt.decode(token) as any
    expect(decoded.sub).toBe('user2')
    expect(decoded.roleId).toBe('role2')
  })

  it('token expires in roughly 7 days', () => {
    const before  = Math.floor(Date.now() / 1000)
    const token   = signRefreshToken({ sub: 'u', roleId: 'r' })
    const decoded = jwt.decode(token) as any
    const expectedExp = before + 7 * 24 * 60 * 60
    expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 2)
    expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 2)
  })
})

describe('verifyRefreshToken', () => {
  it('returns the payload for a valid token', () => {
    const token   = signRefreshToken({ sub: 'user3', roleId: 'role3' })
    const payload = verifyRefreshToken(token)
    expect(payload.sub).toBe('user3')
    expect(payload.roleId).toBe('role3')
  })

  it('throws for an invalid token', () => {
    expect(() => verifyRefreshToken('not.a.token')).toThrow()
  })

  it('throws for a token signed with the wrong secret', () => {
    const badToken = jwt.sign({ sub: 'x', roleId: 'y' }, 'wrong_secret', { expiresIn: 3600 })
    expect(() => verifyRefreshToken(badToken)).toThrow()
  })

  it('throws for an expired token', async () => {
    const expired = jwt.sign({ sub: 'x', roleId: 'y' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: -1 })
    expect(() => verifyRefreshToken(expired)).toThrow()
  })
})

describe('hashToken', () => {
  it('returns a 64-char hex string', () => {
    const hash = hashToken('mytoken')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same input produces same hash', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('different inputs produce different hashes', () => {
    expect(hashToken('abc')).not.toBe(hashToken('def'))
  })
})

describe('TTL constants', () => {
  it('ACCESS_TTL_MS is 15 minutes in ms', () => {
    expect(ACCESS_TTL_MS).toBe(15 * 60 * 1000)
  })

  it('REFRESH_TTL_MS is 7 days in ms', () => {
    expect(REFRESH_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})
