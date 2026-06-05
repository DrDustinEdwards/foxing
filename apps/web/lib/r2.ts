import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const R2_ACCOUNT_ID = 'f852925ce701e6c56f6feae83f0eb2d3'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKETS = {
  covers: 'foxing-covers',
  epubs: 'foxing-epubs',
  avatars: 'foxing-avatars',
  journalImages: 'foxing-journal-images',
} as const

export const R2_PUBLIC_URLS = {
  covers: 'https://pub-d196a43c0eb646b492c40d4f5e588943.r2.dev',
  epubs: 'https://pub-c44d42294a474222a1627ab8644565cb.r2.dev',
  avatars: 'https://pub-632e7267e83d4335b27c6425f95e6e6d.r2.dev',
  journalImages: 'https://pub-c53c4e2f4743416db3244c097f4fac88.r2.dev',
} as const

export async function uploadToR2(
  bucket: keyof typeof R2_BUCKETS,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKETS[bucket],
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  return `${R2_PUBLIC_URLS[bucket]}/${key}`
}

export async function deleteFromR2(
  bucket: keyof typeof R2_BUCKETS,
  key: string,
): Promise<void> {
  await r2.send(new DeleteObjectCommand({
    Bucket: R2_BUCKETS[bucket],
    Key: key,
  }))
}
