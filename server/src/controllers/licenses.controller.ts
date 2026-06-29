import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import * as LicensesService from '../services/licenses.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const verifySchema = z.object({
  key: z.string().min(1),
})

const createLicenseSchema = z.object({
  userId:    z.string().regex(/^[a-f\d]{24}$/i),
  productId: z.string().regex(/^[a-f\d]{24}$/i),
})

export const verifyLicense = asyncHandler(async (req: Request, res: Response) => {
  const { key } = verifySchema.parse(req.body)
  const result = await LicensesService.verifyLicense(key)
  res.json(result)
})

export const createLicense = asyncHandler(async (req: Request, res: Response) => {
  const { userId, productId } = createLicenseSchema.parse(req.body)
  const license = await LicensesService.createLicense(new mongoose.Types.ObjectId(userId), productId)
  res.status(201).json({ license })
})

export const listLicenses = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.query.user_id as string | undefined
  const licenses = await LicensesService.listLicenses(userId)
  res.json({ licenses })
})
