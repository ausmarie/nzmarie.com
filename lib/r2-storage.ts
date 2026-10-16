import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'a128bb5285b94a778d4b098fbd8266f1';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'mock-r2-access-key-id';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'mock-r2-secret-access-key';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'nzmarie-reports';
const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'https://reports.nzmarie.com';
export const STREETVIEW_PREFIX = 'streetview';

export const isR2Mock =
  R2_ACCESS_KEY_ID.startsWith('mock-') ||
  R2_SECRET_ACCESS_KEY.startsWith('mock-') ||
  !process.env.R2_ACCESS_KEY_ID ||
  !process.env.R2_SECRET_ACCESS_KEY ||
  !process.env.R2_BUCKET_NAME;

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType: string = 'application/pdf', cacheControl?: string): Promise<string> {
  if (R2_ACCESS_KEY_ID.startsWith('mock-')) {
    console.log('Skipping real R2 upload due to mock credentials');
    return key;
  }
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(cacheControl ? { CacheControl: cacheControl } : {}),
  });
  await s3Client.send(command);
  return key;
}

export async function createPresignedUploadUrl(key: string, contentType: string = 'application/pdf', expiresIn: number = 600): Promise<string> {
  if (isR2Mock) {
    return `https://mock-r2.example.com/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function getLocalReportUrl(key: string): string {
  const path = key.startsWith("reports/") ? key.slice("reports/".length) : key;
  return `/reports/pdf/${path}`;
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 300): Promise<string> {
  if (isR2Mock) {
    return getLocalReportUrl(key);
  }
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFromR2(key: string): Promise<void> {
  if (R2_ACCESS_KEY_ID.startsWith('mock-')) {
    console.log('Skipping real R2 delete due to mock credentials');
    return;
  }
  await s3Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }));
}
