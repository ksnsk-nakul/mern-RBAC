import type { Response } from 'express'
import { env } from '../config/env.js'
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './jwt.js'

const isProduction = env.NODE_ENV === 'production'

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure:   isProduction,
    sameSite: 'strict',
    path:     '/',
    maxAge:   ACCESS_TTL_MS,
  })
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure:   isProduction,
    sameSite: 'strict',
    path:     '/',
    maxAge:   REFRESH_TTL_MS,
  })
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token',  { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' })
  res.clearCookie('refresh_token', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' })
}
