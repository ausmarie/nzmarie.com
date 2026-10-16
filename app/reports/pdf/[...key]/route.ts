import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { slugMap } from "../../../../lib/report-data";

const BASE_DIR = path.resolve(process.cwd(), "tmp", "r2-mock-reports");

function sanitizeKeyFromPath(raw: string): string {
  let key = raw;
  if (key.startsWith("/reports/pdf/")) key = key.slice("/reports/pdf/".length);
  key = decodeURIComponent(key);
  const normalized = path.normalize(key);
  if (normalized.includes("..")) throw new Error("Invalid report key");
  return normalized;
}

function findReportPath(sanitizedKey: string): string | null {
  let reportPath = path.join(BASE_DIR, sanitizedKey);
  if (fs.existsSync(reportPath) && fs.statSync(reportPath).isFile()) return reportPath;
  reportPath = path.join(BASE_DIR, "reports", sanitizedKey);
  if (fs.existsSync(reportPath) && fs.statSync(reportPath).isFile()) return reportPath;
  return null;
}

function resolveSlug(slug: string): string | null {
  const entry = slugMap[slug.toLowerCase()];
  if (!entry) return null;
  const p = path.join(BASE_DIR, "reports", entry.suburb, `${entry.version}.pdf`);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const rawKey = pathname.replace(/^\/reports\/pdf\//, "");
    if (!rawKey) {
      return NextResponse.json({ error: "Missing report key" }, { status: 400 });
    }

    const sanitizedKey = sanitizeKeyFromPath(rawKey);
    let reportPath = findReportPath(sanitizedKey);
    if (!reportPath) reportPath = resolveSlug(sanitizedKey);

    if (!reportPath || !reportPath.startsWith(BASE_DIR)) {
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
    console.error("Local reports path fetch error:", error);
    return NextResponse.json({ error: "Unable to fetch report" }, { status: 500 });
  }
}
