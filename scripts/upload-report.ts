import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

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

async function main() {
  loadEnv();

  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
  const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
  const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const PDF_PATH = path.resolve(process.argv[2] || "./pdf/Northcross_Market_Report_2026_YTD_H1.pdf");
  const SUBURB = process.argv[3] || "Northcross";
  const VERSION = process.argv[4] || "2026-YTD-H1";
  const TITLE = process.argv[5] || "Northcross Market Report 2026 YTD H1";
  const R2_KEY = `reports/${SUBURB}/${VERSION}.pdf`;

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  const isMock = R2_ACCESS_KEY_ID?.startsWith("mock-") || !R2_ACCESS_KEY_ID;
  const fileBuffer = fs.readFileSync(PDF_PATH);
  const fileSize = fileBuffer.length;

  if (isMock) {
    console.log("Mock R2 credentials detected. Copying file to local debug folder...");
    const destDir = path.resolve(`./tmp/r2-mock-reports/${SUBURB}`);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${VERSION}.pdf`);
    fs.copyFileSync(PDF_PATH, destPath);
    console.log(`Copied local report to ${destPath}`);
  } else {
    console.log(`Uploading ${PDF_PATH} (${(fileSize / 1024).toFixed(1)} KB) to R2 as ${R2_KEY}...`);
    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: R2_KEY,
      Body: fileBuffer,
      ContentType: "application/pdf",
    }));
    console.log(`Uploaded to R2: ${R2_KEY}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });

  await pool.query(`UPDATE market_reports SET is_active = false WHERE suburb = $1`, [SUBURB]);

  const result = await pool.query<{ id: string }>(
    `INSERT INTO market_reports (suburb, version, title, r2_key, file_size, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (r2_key) DO UPDATE SET is_active = true, suburb = EXCLUDED.suburb, version = EXCLUDED.version, title = EXCLUDED.title, file_size = EXCLUDED.file_size
     RETURNING id`,
    [SUBURB, VERSION, TITLE, R2_KEY, fileSize]
  );

  if (result.rows.length > 0) {
    console.log(`Registered in DB with id: ${result.rows[0].id}`);
  } else {
    console.log("Report already exists in DB (no duplicate inserted).");
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
