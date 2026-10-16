import { NextResponse } from "next/server";
import { query, marieDB } from "../../../../lib/db";
import { hashEmail, hashIP } from "../../../../lib/hash";
import { getSignedDownloadUrl } from "../../../../lib/r2-storage";
import { updateDownloadTracking } from "../../../../lib/tracking";

const DOWNLOAD_LIMIT = 5;
const DOWNLOAD_WINDOW_DAYS = 30;
const allowedSuburbs = ["Oteha", "Northcross", "Albany", "Browns Bay", "Glenfield", "Pinehill", "Rosedale", "Long Bay", "Torbay", "Mairangi Bay", "North Shore", "Others"];

function isAllowedSuburb(value: unknown): value is string {
  return typeof value === "string" && allowedSuburbs.includes(value);
}

function getRows<T>(result: { rows?: T[] } | null | undefined): T[] {
  return Array.isArray((result as { rows?: T[] } | null | undefined)?.rows) ? ((result as { rows?: T[] } | null | undefined)?.rows ?? []) : [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      firstName?: string;
      email?: string;
      phone?: string;
      suburb?: string;
      subscribe?: boolean;
    };
    const { firstName, email, phone, suburb, subscribe } = body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      typeof firstName !== "string" ||
      firstName.trim().length === 0 ||
      typeof email !== "string" ||
      email.trim().length === 0 ||
      !emailRegex.test(email) ||
      !isAllowedSuburb(suburb)
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
      [emailHash, DOWNLOAD_WINDOW_DAYS]
    );

    const recentRows = getRows<{ count: string }>(recentResult);
    const recentCount = Number(recentRows[0]?.count ?? 0);
    if (recentCount >= DOWNLOAD_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          reason: "limit",
          message:
            "You've reached the download limit for this report. Please contact Marie for a more detailed market analysis.",
        },
        { status: 429 }
      );
    }

    const suburbReportResult = await query<{ id: string; file_url: string }>(
      `SELECT id, file_url FROM suburb_reports WHERE suburb = $1 AND status = 'active'
       ORDER BY
         CASE WHEN COALESCE(doc_label, 'Main Report') = 'Main Report' THEN 0 ELSE 1 END,
         year DESC, quarter DESC, uploaded_at DESC
       LIMIT 1`,
      [suburb]
    );
    const suburbReportRows = getRows<{ id: string; file_url: string }>(suburbReportResult);

    let fileUrlFromSuburbReports: string | null = null;
    let r2Key: string | null = null;

    if (suburbReportRows.length > 0 && suburbReportRows[0].file_url) {
      fileUrlFromSuburbReports = suburbReportRows[0].file_url;
      r2Key = `reports/${suburb}/latest.pdf`;
      await query(
        `UPDATE suburb_reports SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1`,
        [suburbReportRows[0].id]
      ).catch(() => null);
    } else {
      const reportResult = await query<{ r2_key: string }>(
        `SELECT r2_key FROM market_reports WHERE suburb = $1 AND is_active = true LIMIT 1`,
        [suburb]
      );
      const reportRows = getRows<{ r2_key: string }>(reportResult);
      if (reportRows.length > 0) {
        r2Key = reportRows[0].r2_key;
      }
    }

    if (!r2Key) {
      return NextResponse.json(
        {
          success: false,
          reason: "no_report",
          message: "The report for this suburb is currently being prepared. Please check back soon.",
        },
        { status: 200 }
      );
    }

    const insertResult = await query<{ id: string }>(
      `INSERT INTO report_download_events
       (email, email_hash, first_name, phone, suburb, accept_monthly_newsletter, ip_hash, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
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
      ]
    );

    const insertRows = getRows<{ id: string }>(insertResult);
    const eventId = insertRows[0]?.id;

    if (!eventId) {
      return NextResponse.json({ success: false, message: "Failed to create download event" }, { status: 500 });
    }

    if (fileUrlFromSuburbReports) {
      await query(`UPDATE report_download_events SET status = 'completed' WHERE id = $1`, [eventId]);
      return NextResponse.json({ success: true, action: 'download', downloadUrl: fileUrlFromSuburbReports });
    }

    if (process.env.NODE_ENV === 'production') {
      const r2Access = process.env.R2_ACCESS_KEY_ID;
      const r2Secret = process.env.R2_SECRET_ACCESS_KEY;
      const r2Bucket = process.env.R2_BUCKET_NAME;
      const r2Public = process.env.R2_PUBLIC_DOMAIN;

      const r2Misconfigured =
        !r2Access ||
        !r2Secret ||
        !r2Bucket ||
        r2Access.startsWith('mock-') ||
        r2Secret.startsWith('mock-');

      if (r2Misconfigured) {
        // Fallback: if a public R2 domain is configured, return a public URL so downloads still work
        if (r2Public) {
          const publicDomain = r2Public.replace(/\/+$/, '');
          const publicPath = r2Key.replace(/^\//, '');
          const downloadUrl = `${publicDomain}/${publicPath}`;
          await query(`UPDATE report_download_events SET status = 'completed' WHERE id = $1`, [eventId]);
          return NextResponse.json({ success: true, action: 'download', downloadUrl });
        }

        console.error('R2 is not configured in production environment');
        return NextResponse.json(
          { success: false, message: 'Report storage is not configured in production.' },
          { status: 500 }
        );
      }
    }

    const downloadUrl = await getSignedDownloadUrl(r2Key, 300);

    await query(`UPDATE report_download_events SET status = 'completed' WHERE id = $1`, [eventId]);

    const trackingCodeFromUrl = new URL(req.url).searchParams.get('tc');
    try {
      await marieDB.ensureOutreachTablesExist?.();
      const result = await query(
        `INSERT INTO report_downloads 
         (email, name, phone, suburb, report_type, downloaded_at, source, tracking_code, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9)
         RETURNING id, email, suburb`,
        [
          normalizedEmail,
          firstName.trim(),
          typeof phone === 'string' && phone.trim().length > 0 ? phone.trim() : null,
          suburb,
          'local_market',
          trackingCodeFromUrl ? 'direct_mail' : 'organic',
          trackingCodeFromUrl || null,
          userAgent.substring(0, 500),
          ip.substring(0, 45),
        ]
      );
      
      const downloadRows = getRows<{ id: string; email?: string | null; suburb?: string | null }>(result as unknown as { rows?: Array<{ id: string; email?: string | null; suburb?: string | null }> } | null | undefined);
      if (downloadRows.length > 0) {
        console.log('✅ Successfully inserted into report_downloads:', {
          id: downloadRows[0].id,
          email: downloadRows[0].email,
          suburb: downloadRows[0].suburb,
          source: trackingCodeFromUrl ? 'direct_mail' : 'organic'
        });
      } else {
        console.warn('⚠️ No rows returned from report_downloads insert for:', normalizedEmail, suburb);
      }
    } catch (err) {
      console.error('❌ CRITICAL: Failed to insert into report_downloads:', {
        error: err instanceof Error ? err.message : String(err),
        email: normalizedEmail,
        name: firstName.trim(),
        phone: typeof phone === 'string' && phone.trim().length > 0 ? phone.trim() : null,
        suburb,
        source: trackingCodeFromUrl ? 'direct_mail' : 'organic',
        trackingCode: trackingCodeFromUrl
      });
    }

    // Update tracking for direct mail campaigns (if tracking code exists)
    // This replaces what would normally be done by database triggers
    if (trackingCodeFromUrl) {
      await updateDownloadTracking(normalizedEmail, suburb, trackingCodeFromUrl).catch(err => {
        console.error('Failed to update download tracking:', err);
      });
    }

    try {
      const trackingCodeFromUrl = new URL(req.url).searchParams.get('tc');

      if (trackingCodeFromUrl) {
        // If a tracking code (QR token) is present, use it to find the exact outreach property
        const tokenResult = await marieDB.query(
          `SELECT oqt.outreach_property_id, op.status
           FROM outreach_qr_tokens oqt
           JOIN outreach_properties op ON op.id = oqt.outreach_property_id
           WHERE oqt.token = $1
           LIMIT 1`,
          [trackingCodeFromUrl]
        );

        const tokenRows = getRows<{ outreach_property_id: string; status: string }>(tokenResult);
        if (tokenRows.length > 0) {
          const { outreach_property_id, status } = tokenRows[0];
          if (status === 'sent') {
            await marieDB.query(
              `UPDATE outreach_properties 
               SET status = 'interacted', interacted_at = NOW() 
               WHERE id = $1 AND status = 'sent'`,
              [outreach_property_id]
            );
            console.log(`✅ Updated outreach property ${outreach_property_id} to 'interacted' via tracking code`);
          }
        }
      } else {
        // Fallback: best-effort match by suburb/address fragment (when no tracking code available)
        const outreachResult = await marieDB.query(
          `SELECT id, status FROM outreach_properties 
           WHERE property_address ILIKE $1 
             AND suburb = $2 
             AND status IN ('sent', 'pending')
           ORDER BY created_at DESC
           LIMIT 1`,
          [`%${suburb}%`, suburb]
        );

        const outreachRows = getRows<{ id: string; status: string }>(outreachResult);
        if (outreachRows.length > 0) {
          const outreachProperty = outreachRows[0];
          if (outreachProperty.status === 'sent') {
            await marieDB.query(
              `UPDATE outreach_properties 
               SET status = 'interacted', 
                   interacted_at = NOW() 
               WHERE id = $1`,
              [outreachProperty.id]
            );
            console.log(`✅ Updated outreach property ${outreachProperty.id} to 'interacted' status`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to update outreach status:', err);
    }

    return NextResponse.json({ success: true, action: "download", downloadUrl });
  } catch (error) {
    console.error("Report Download Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
