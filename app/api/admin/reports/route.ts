import { NextResponse } from "next/server";
import { auth, hasPermission } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await query(
    `SELECT id, suburb, version, title, r2_key, file_size, is_active, created_at
     FROM market_reports
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ success: true, reports: result.rows });
}
