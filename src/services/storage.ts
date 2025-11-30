import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { env } from '../config/env'

export interface FileStorage {
  uploadPDF(buffer: Buffer, filename: string): Promise<string>
  uploadFile(buffer: Buffer, filename: string, contentType?: string): Promise<string>
  deleteFile(fileUrl: string): Promise<void>
  getSignedUrl(fileUrl: string): Promise<string>
}

class InMemoryFileStorage implements FileStorage {
  store = new Map<string, Buffer>()
  async uploadPDF(buffer: Buffer, filename: string) { this.store.set(filename, buffer); return `memory://${filename}` }
  async uploadFile(buffer: Buffer, filename: string, contentType?: string) { this.store.set(filename, buffer); return `memory://${filename}` }
  async deleteFile(fileUrl: string) { const key = fileUrl.replace('memory://',''); this.store.delete(key) }
  async getSignedUrl(fileUrl: string) { return fileUrl }
}

class S3FileStorage implements FileStorage {
  s3: S3Client
  bucket: string
  region: string
  domain?: string
  constructor(region: string, bucket: string, domain?: string) { this.region = region; this.bucket = bucket; this.domain = domain; this.s3 = new S3Client({ region }) }
  async uploadPDF(buffer: Buffer, filename: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: filename, Body: buffer, ContentType: 'application/pdf', ACL: 'private' }))
    if (this.domain) return `https://${this.domain}/${filename}`
    return `https://s3.${this.region}.amazonaws.com/${this.bucket}/${filename}`
  }
  async uploadFile(buffer: Buffer, filename: string, contentType?: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: filename, Body: buffer, ContentType: contentType || 'application/octet-stream', ACL: 'private' }))
    if (this.domain) return `https://${this.domain}/${filename}`
    return `https://s3.${this.region}.amazonaws.com/${this.bucket}/${filename}`
  }
  async deleteFile(fileUrl: string) {
    const u = new URL(fileUrl)
    const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
  async getSignedUrl(fileUrl: string) {
    const u = new URL(fileUrl)
    const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return await getSignedUrl(this.s3, cmd, { expiresIn: 3600 })
  }
}

export function getStorageService(): FileStorage {
  if (env.AWS_REGION && env.AWS_S3_BUCKET) return new S3FileStorage(env.AWS_REGION, env.AWS_S3_BUCKET, env.CLOUDFRONT_DOMAIN || undefined)
  return new InMemoryFileStorage()
}