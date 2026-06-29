import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import * as ProductsService from '../services/products.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const createProductSchema = z.object({
  name:         z.string().min(1).max(255),
  slug:         z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description:  z.string().max(5000).optional().default(''),
  price:        z.number().min(0),
  currency:     z.string().length(3).optional().default('USD'),
  billingCycle: z.enum(['monthly', 'yearly', 'one_time']).optional().default('monthly'),
  features:     z.array(z.string()).optional().default([]),
})

const updateProductSchema = z.object({
  name:         z.string().min(1).max(255).optional(),
  slug:         z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description:  z.string().max(5000).optional(),
  price:        z.number().min(0).optional(),
  currency:     z.string().length(3).optional(),
  billingCycle: z.enum(['monthly', 'yearly', 'one_time']).optional(),
  features:     z.array(z.string()).optional(),
  isActive:     z.boolean().optional(),
})

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const page  = Number(req.query.page)  || 1
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined
  const result = await ProductsService.listProducts({ isActive, page, limit })
  res.json(result)
})

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = createProductSchema.parse(req.body)
  const product = await ProductsService.createProduct(input)
  res.status(201).json({ product })
})

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductsService.getProduct(req.params.id as string)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json({ product })
})

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProductSchema.parse(req.body)
  const product = await ProductsService.updateProduct(req.params.id as string, input)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  res.json({ product })
})

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await ProductsService.deleteProduct(req.params.id as string)
  if (!deleted) return res.status(404).json({ error: 'Product not found' })
  res.status(204).send()
})
