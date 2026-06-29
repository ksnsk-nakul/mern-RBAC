import mongoose from 'mongoose'
import { Product, type IProduct } from '../models/Product.js'

export interface ProductItem {
  id:          string
  name:        string
  slug:        string
  description: string
  price:       number
  currency:    string
  billingCycle: string
  features:    string[]
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface ListProductsOpts {
  isActive?: boolean
  page:      number
  limit:     number
}

function toItem(p: IProduct): ProductItem {
  return {
    id:          String(p._id),
    name:        p.name,
    slug:        p.slug,
    description: p.description,
    price:       p.price,
    currency:    p.currency,
    billingCycle: p.billingCycle,
    features:    p.features,
    isActive:    p.isActive,
    createdAt:   p.createdAt.toISOString(),
    updatedAt:   p.updatedAt.toISOString(),
  }
}

export async function listProducts(opts: ListProductsOpts) {
  const { isActive, page, limit } = opts
  const filter: Record<string, unknown> = {}
  if (isActive !== undefined) filter.isActive = isActive

  const skip = (page - 1) * limit
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ])

  return {
    products: products.map((p) => toItem(p as unknown as IProduct)),
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function createProduct(input: {
  name: string; slug: string; description?: string; price: number
  currency?: string; billingCycle?: string; features?: string[]
}): Promise<ProductItem> {
  const product = await Product.create(input)
  return toItem(product)
}

export async function getProduct(id: string): Promise<ProductItem | null> {
  if (!mongoose.isValidObjectId(id)) return null
  const product = await Product.findById(id).lean()
  return product ? toItem(product as unknown as IProduct) : null
}

export async function updateProduct(id: string, input: Partial<{
  name: string; slug: string; description: string; price: number
  currency: string; billingCycle: string; features: string[]; isActive: boolean
}>): Promise<ProductItem | null> {
  if (!mongoose.isValidObjectId(id)) return null
  const product = await Product.findByIdAndUpdate(id, input, { new: true }).lean()
  return product ? toItem(product as unknown as IProduct) : null
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id)) return false
  const result = await Product.findByIdAndDelete(id)
  return result !== null
}
