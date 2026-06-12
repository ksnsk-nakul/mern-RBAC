import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { env } from '../config/env.js'

// SECRETS_ENCRYPTION_KEY is 64 hex chars = 32 bytes for AES-256
function getKey(): Buffer {
  return Buffer.from(env.SECRETS_ENCRYPTION_KEY, 'hex')
}

export interface EncryptedPayload {
  encryptedValue: string  // base64
  iv:             string  // base64, 12 bytes for GCM
  authTag:        string  // base64, 16 bytes
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey()
  const iv  = randomBytes(12)  // 96-bit IV recommended for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()

  return {
    encryptedValue: encrypted.toString('base64'),
    iv:             iv.toString('base64'),
    authTag:        authTag.toString('base64'),
  }
}

export function decrypt(payload: EncryptedPayload): string {
  const key       = getKey()
  const iv        = Buffer.from(payload.iv, 'base64')
  const authTag   = Buffer.from(payload.authTag, 'base64')
  const encrypted = Buffer.from(payload.encryptedValue, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(encrypted) + decipher.final('utf8')
}
