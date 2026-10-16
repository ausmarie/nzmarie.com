import { NextResponse } from "next/server";
import { auth, hasPermission } from "../../../../../lib/auth";
import { query } from "../../../../../lib/db";
import { uploadToR2 } from "../../../../../lib/r2-storage";
import { logAdminAction } from "../../../../../lib/audit-log";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const suburb = formData.get("suburb") as string;
    const version = formData.get("version") as string;
    const title = formData.get("title") as string;

    if (!file || !suburb || !version || !title) {
      return NextResponse.json({ error: "Missing required fields: file, suburb, version, title" }, { status: 400 });
    }

    const r2Key = `reports/${suburb}/${version}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(r2Key, buffer, "application/pdf");

    await query(`UPDATE market_reports SET is_active = false WHERE suburb = $1`, [suburb]);

    const insertResult = await query<{ id: string }>(
      `INSERT INTO market_reports (suburb, version, title, r2_key, file_size, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [suburb, version, title, r2Key, buffer.length]
    );

    const reportId = insertResult.rows[0].id;

    await logAdminAction({
      adminId: session.user.adminId,
      action: "upload_report",
      resourceType: "market_report",
      resourceId: reportId,
      details: { suburb, version, r2Key },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, reportId, r2Key });
  } catch (error) {
    console.error("Report upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
