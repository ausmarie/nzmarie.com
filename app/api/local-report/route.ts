import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const BASE_DIR = path.resolve(process.cwd(), "tmp", "r2-mock-reports");

function sanitizeKey(key: string): string {
  const normalized = path.normalize(key);
  if (normalized.includes("..")) {
    throw new Error("Invalid report key");
  }
  return normalized;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const sanitizedKey = sanitizeKey(key);
    const reportPath = path.join(BASE_DIR, sanitizedKey);

    if (!reportPath.startsWith(BASE_DIR)) {
      return NextResponse.json({ error: "Invalid report path" }, { status: 400 });
    }

    if (!fs.existsSync(reportPath) || !fs.statSync(reportPath).isFile()) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(reportPath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(reportPath)}"`,
      },
    });
  } catch (error) {
    console.error("Local report fetch error:", error);
    return NextResponse.json({ error: "Unable to fetch report" }, { status: 500 });
  }
}
