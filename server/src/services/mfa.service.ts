import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { NotFoundError, AppError } from '../lib/errors.js'

const RECOVERY_CODE_COUNT = 8
const RECOVERY_CODE_BYTES = 10

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex')
}

function generateRecoveryCodes(): { raw: string[]; hashes: string[] } {
  const raw = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex').toUpperCase()
  )
  return { raw, hashes: raw.map(hashCode) }
}

export interface MfaSetupResult {
  qrCodeDataUrl: string
  secret:        string
  recoveryCodes: string[]
}

export async function generateMfaSetup(userId: mongoose.Types.ObjectId, appName: string): Promise<MfaSetupResult> {
  const user = await User.findById(userId).select('+mfaTotpSecret +mfaRecoveryCodes')
  if (!user) throw new NotFoundError('User not found')
  if (user.mfaEnabled) throw new AppError('MFA is already enabled', 400, 'MFA_ALREADY_ENABLED')

  const secretObj = speakeasy.generateSecret({ name: `${appName} (${user.email})`, length: 20 })
  const { raw, hashes } = generateRecoveryCodes()

  user.mfaTotpSecret    = secretObj.base32
  user.mfaRecoveryCodes = hashes
  await user.save()

  const qrCodeDataUrl = await QRCode.toDataURL(secretObj.otpauth_url!)
  return { qrCodeDataUrl, secret: secretObj.base32, recoveryCodes: raw }
}

export async function verifyAndEnableMfa(userId: mongoose.Types.ObjectId, totpCode: string): Promise<void> {
  const user = await User.findById(userId).select('+mfaTotpSecret +mfaRecoveryCodes')
  if (!user) throw new NotFoundError('User not found')
  if (!user.mfaTotpSecret) throw new AppError('MFA setup not started — call /mfa/setup first', 400, 'MFA_NOT_SETUP')
  if (user.mfaEnabled)     throw new AppError('MFA is already enabled', 400, 'MFA_ALREADY_ENABLED')

  const valid = verifyTotp(user.mfaTotpSecret, totpCode)
  if (!valid) throw new AppError('Invalid TOTP code', 400, 'INVALID_TOTP')

  user.mfaEnabled = true
  await user.save()
}

export async function disableMfa(userId: mongoose.Types.ObjectId, totpCode: string): Promise<void> {
  const user = await User.findById(userId).select('+mfaTotpSecret +mfaRecoveryCodes')
  if (!user) throw new NotFoundError('User not found')
  if (!user.mfaEnabled) throw new AppError('MFA is not enabled', 400, 'MFA_NOT_ENABLED')

  const valid = verifyTotp(user.mfaTotpSecret!, totpCode)
  if (!valid) throw new AppError('Invalid TOTP code', 400, 'INVALID_TOTP')

  user.mfaEnabled       = false
  user.mfaTotpSecret    = undefined
  user.mfaRecoveryCodes = []
  await user.save()
}

export function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 })
}

export async function useRecoveryCode(userId: mongoose.Types.ObjectId, code: string): Promise<void> {
  const user = await User.findById(userId).select('+mfaTotpSecret +mfaRecoveryCodes')
  if (!user) throw new NotFoundError('User not found')
  if (!user.mfaEnabled) throw new AppError('MFA is not enabled', 400, 'MFA_NOT_ENABLED')

  const hash = hashCode(code)
  const idx  = user.mfaRecoveryCodes.indexOf(hash)
  if (idx === -1) throw new AppError('Invalid recovery code', 400, 'INVALID_RECOVERY_CODE')

  user.mfaRecoveryCodes.splice(idx, 1)
  await user.save()
}

export async function regenerateRecoveryCodes(
  userId: mongoose.Types.ObjectId,
  totpCode: string,
): Promise<string[]> {
  const user = await User.findById(userId).select('+mfaTotpSecret +mfaRecoveryCodes')
  if (!user) throw new NotFoundError('User not found')
  if (!user.mfaEnabled) throw new AppError('MFA is not enabled', 400, 'MFA_NOT_ENABLED')

  const valid = verifyTotp(user.mfaTotpSecret!, totpCode)
  if (!valid) throw new AppError('Invalid TOTP code', 400, 'INVALID_TOTP')

  const { raw, hashes } = generateRecoveryCodes()
  user.mfaRecoveryCodes = hashes
  await user.save()
  return raw
}

export async function getMfaStatus(userId: mongoose.Types.ObjectId): Promise<{ enabled: boolean; codesRemaining: number }> {
  const user = await User.findById(userId).select('+mfaRecoveryCodes')
  if (!user) throw new NotFoundError('User not found')
  return { enabled: user.mfaEnabled, codesRemaining: user.mfaRecoveryCodes.length }
}
