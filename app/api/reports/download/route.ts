import { NextResponse } from "next/server";
import { query, marieDB } from "../../../../lib/db";
import { hashEmail, hashIP } from "../../../../lib/hash";
import { updateDownloadTracking } from "../../../../lib/tracking";
import { SUBURB_PRIORITY_ORDER } from "../../../../lib/suburb-order";

const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_DAYS = 30;
const allowedSuburbs: readonly string[] = SUBURB_PRIORITY_ORDER;

function isAllowedSuburb(value: unknown): value is string {
  return typeof value === "string" && allowedSuburbs.includes(value);
}

function isSupportedLanguage(value: unknown): value is "en" | "zh" {
  return value === "en" || value === "zh";
}

function getRows<T>(result: { rows?: T[] } | null | undefined): T[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      firstName?: string;
      email?: string;
      phone?: string;
      suburb?: string;
      subscribe?: boolean;
      entryLanguage?: unknown;
      preferredLanguage?: unknown;
    };
    const { firstName, email, phone, suburb, subscribe } = body;
    const entryLanguage = body.entryLanguage ?? "en";
    const preferredLanguage = body.preferredLanguage ?? entryLanguage;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      typeof firstName !== "string" ||
      firstName.trim().length === 0 ||
      typeof email !== "string" ||
      email.trim().length === 0 ||
      !emailRegex.test(email) ||
      !isAllowedSuburb(suburb) ||
      !isSupportedLanguage(entryLanguage) ||
      !isSupportedLanguage(preferredLanguage)
    ) {
      return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
    }

    if ((phone && typeof phone !== "string") || (subscribe !== undefined && typeof subscribe !== "boolean")) {
      return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailHash = hashEmail(normalizedEmail);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = hashIP(ip);
    const userAgent = req.headers.get("user-agent") || "";

    const recentResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM report_download_events
       WHERE email_hash = $1
         AND created_at >= now() - ($2::text || ' days')::interval
         AND status != 'failed'`,
      [emailHash, REQUEST_WINDOW_DAYS]
    );
    const recentCount = Number(getRows(recentResult)[0]?.count ?? 0);
    if (recentCount >= REQUEST_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          reason: "limit",
          message:
            "You've reached the request limit for this report. Please contact Marie for assistance.",
        },
        { status: 429 }
      );
    }

    const eventResult = await query<{ id: string }>(
      `INSERT INTO report_download_events
       (email, email_hash, first_name, phone, suburb, accept_monthly_newsletter, ip_hash, user_agent, entry_language, preferred_language, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING id`,
      [
        normalizedEmail,
        emailHash,
        firstName.trim(),
        typeof phone === "string" ? phone.trim() : "",
        suburb,
        subscribe === true,
        ipHash,
        userAgent,
        entryLanguage,
        preferredLanguage,
      ]
    );
    const eventId = getRows(eventResult)[0]?.id;
    if (!eventId) {
      return NextResponse.json({ success: false, message: "Failed to create report request" }, { status: 500 });
    }

    await marieDB.ensureOutreachTablesExist?.();
    const trackingCode = new URL(req.url).searchParams.get("tc");
    const downloadResult = await query<{ id: string }>(
      `INSERT INTO report_downloads
       (email, name, phone, suburb, report_type, downloaded_at, source, tracking_code, user_agent, ip_address, entry_language, preferred_language)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        normalizedEmail,
        firstName.trim(),
        typeof phone === "string" && phone.trim().length > 0 ? phone.trim() : null,
        suburb,
        "local_market",
        trackingCode ? "direct_mail" : "organic",
        trackingCode,
        userAgent.substring(0, 500),
        ip.substring(0, 45),
        entryLanguage,
        preferredLanguage,
      ]
    );

    if (!getRows(downloadResult)[0]?.id) {
      return NextResponse.json({ success: false, message: "Failed to record report request" }, { status: 500 });
    }

    if (trackingCode) {
      try {
        await updateDownloadTracking(normalizedEmail, suburb, trackingCode);
      } catch (error) {
        console.error("Failed to update download tracking:", error);
      }
    }

    try {
      if (trackingCode) {
        const tokenResult = await marieDB.query(
          `SELECT oqt.outreach_property_id, op.status
           FROM outreach_qr_tokens oqt
           JOIN outreach_properties op ON op.id = oqt.outreach_property_id
           WHERE oqt.token = $1
           LIMIT 1`,
          [trackingCode]
        );
        const tokenRows = getRows<{ outreach_property_id: string; status: string }>(tokenResult);
        if (tokenRows.length > 0 && tokenRows[0].status === "sent") {
          await marieDB.query(
            `UPDATE outreach_properties
             SET status = 'interacted', interacted_at = NOW()
             WHERE id = $1 AND status = 'sent'`,
            [tokenRows[0].outreach_property_id]
          );
        }
      }
    } catch (error) {
      console.error("Failed to update outreach status:", error);
    }

    return NextResponse.json({
      success: true,
      action: "request",
      message: "Your suburb report request has been received. Marie will email you when it is ready.",
    });
  } catch (error) {
    console.error("Report Download Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
