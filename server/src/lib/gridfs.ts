// server/src/lib/gridfs.ts
import mongoose from 'mongoose'
import { Readable } from 'stream'
import type { Response } from 'express'

const BUCKET = 'ticketAttachments'

export async function uploadToGridFS(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<mongoose.Types.ObjectId> {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: BUCKET })
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { contentType })
    const readable = Readable.from(buffer)
    readable.pipe(uploadStream)
    uploadStream.on('finish', () => resolve(uploadStream.id as mongoose.Types.ObjectId))
    uploadStream.on('error', reject)
  })
}

export async function streamFromGridFS(
  fileId: mongoose.Types.ObjectId,
  filename: string,
  contentType: string,
  res: Response,
): Promise<void> {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: BUCKET })
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
  return new Promise((resolve, reject) => {
    const stream = bucket.openDownloadStream(fileId)
    stream.on('error', reject)
    stream.on('end', resolve)
    stream.pipe(res)
  })
}
