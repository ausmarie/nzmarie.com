import { NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { hashEmail } from "../../../../lib/hash";

const DOWNLOAD_LIMIT = 5;
const DOWNLOAD_WINDOW_DAYS = 30;

/**
 * Check if user has reached download limit
 * GET /api/reports/check-limit?email=xxx&suburb=xxx
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const suburb = searchParams.get("suburb");

    if (!email || !suburb) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Email and suburb are required" 
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid email format" 
        },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailHash = hashEmail(normalizedEmail);

    // Check downloads in the last 30 days for this email+suburb combination
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM report_download_events
       WHERE email_hash = $1
         AND suburb = $2
         AND created_at >= now() - ($3::text || ' days')::interval
         AND status != 'failed'`,
      [emailHash, suburb, DOWNLOAD_WINDOW_DAYS]
    );

    const downloadCount = Number(result.rows[0].count);
    const remaining = Math.max(0, DOWNLOAD_LIMIT - downloadCount);
    const canDownload = downloadCount < DOWNLOAD_LIMIT;

    return NextResponse.json({
      success: true,
      canDownload,
      downloadCount,
      remaining,
      limit: DOWNLOAD_LIMIT,
      windowDays: DOWNLOAD_WINDOW_DAYS,
      message: canDownload
        ? `You have ${remaining} download${remaining !== 1 ? 's' : ''} remaining this month.`
        : "You've reached the download limit. Please contact Marie for assistance.",
    });
  } catch (error) {
    console.error("Check limit API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error" 
      },
      { status: 500 }
    );
  }
}
