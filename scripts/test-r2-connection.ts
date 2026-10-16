import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed.substring(index + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

async function testR2Connection() {
  loadEnv();
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    console.error('Missing R2 environment variables');
    process.exit(1);
  }

  if (accessKeyId.startsWith('mock-')) {
    console.log('Detected mock R2 credentials, skipping network test');
    return;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    const listResult = await client.send(new ListBucketsCommand({}));
    console.log('R2 Connection successful, buckets found:', listResult.Buckets?.length || 0);
  } catch (error: any) {
    console.error('R2 connection test FAILED:', error.message);
    process.exit(1);
  }
}

testR2Connection();
