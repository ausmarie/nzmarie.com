import { NextResponse } from "next/server";
import { query, marieDB } from "../../../lib/db";
import { hashEmail, isValidEmail } from "../../../lib/hash";
import { sendAppraisalNotification } from "../../../lib/email";
import { updateAppraisalTracking } from "../../../lib/tracking";
import { findLocationBySuburb } from "../../../lib/geo-data";
import { priorityFromTimeline } from "../../../lib/priority";

// Cache whether region/city columns exist to avoid checking every request
let hasLocationColumns: boolean | null = null;

async function checkLocationColumns(): Promise<boolean> {
  if (hasLocationColumns !== null) return hasLocationColumns;
  try {
    const result = await query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
        AND column_name IN ('region', 'city')
    `);
    hasLocationColumns = result.rows.length === 2;
  } catch {
    hasLocationColumns = false;
  }
  return hasLocationColumns;
}

// Cache whether the alert_status column exists (migration 049)
let hasAlertColumn: boolean | null = null;

async function checkAlertColumn(): Promise<boolean> {
  if (hasAlertColumn !== null) return hasAlertColumn;
  try {
    const result = await query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'appraisal_leads'
        AND column_name = 'alert_status'
    `);
    hasAlertColumn = result.rows.length === 1;
  } catch {
    hasAlertColumn = false;
  }
  return hasAlertColumn;
}

export async function POST(req: Request) {
  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await req.json() as {
      name?: string;
      address?: string;
      region?: string;
      city?: string;
      suburb?: string;
      email?: string;
      phone?: string;
      timeline?: string;
      motivation?: string;
      language?: string;
      heard_from?: string;
      priority?: string;
    };
    const {
      name,
      address,
      region,
      city,
      suburb,
      email,
      phone,
      timeline,
      motivation,
      language,
      heard_from,
    } = body;

    // --- Validation ---
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!address || typeof address !== "string" || address.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Address is required" }, { status: 400 });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Phone is required" }, { status: 400 });
    }
    if (!suburb || typeof suburb !== "string" || suburb.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Suburb is required" }, { status: 400 });
    }

    // --- Resolve region and city from suburb if not provided ---
    let resolvedRegion = region?.trim() || null;
    let resolvedCity = city?.trim() || null;

    if (!resolvedRegion || !resolvedCity) {
      const location = findLocationBySuburb(suburb.trim());
      if (location) {
        resolvedRegion = resolvedRegion || location.region;
        resolvedCity = resolvedCity || location.city;
      }
    }

    const emailHash = hashEmail(email);

    // --- Duplicate check ---
    const duplicate = await query<{ id: string }>(
      `SELECT id FROM appraisal_leads
       WHERE email_hash = $1
         AND property_address = $2
         AND created_at > NOW() - INTERVAL '7 days'`,
      [emailHash, address.trim()]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "You have already submitted a request for this property recently." },
        { status: 409 }
      );
    }

    // --- Check whether region/city columns exist (migration 011) ---
    const useLocationColumns = await checkLocationColumns();
    // --- Check whether alert_status column exists (migration 049) ---
    const useAlertColumn = await checkAlertColumn();

    const alertColumnSql = useAlertColumn ? ', alert_status' : '';
    const alertValueSql = useAlertColumn ? ', $14' : '';
    const priority = priorityFromTimeline(timeline);

    if (useLocationColumns) {
      // Full insert with region and city
      await query(
        `INSERT INTO appraisal_leads
         (client_name, property_address, region, city, suburb, email, email_hash, phone,
          timeline, motivation, language_preference, heard_from, priority, priority_source${alertColumnSql})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'auto'${alertValueSql})`,
        [
          name.trim(),
          address.trim(),
          resolvedRegion,
          resolvedCity,
          suburb.trim(),
          email.trim().toLowerCase(),
          emailHash,
          phone.trim(),
          timeline || null,
          motivation || null,
          language || null,
          heard_from || null,
          priority,
          ...(useAlertColumn ? ['pending'] : []),
        ]
      );
    } else {
      // Fallback insert without region/city (migration 011 not yet applied)
      await query(
        `INSERT INTO appraisal_leads
         (client_name, property_address, suburb, email, email_hash, phone,
          timeline, motivation, language_preference, heard_from, priority, priority_source${alertColumnSql})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'auto'${useAlertColumn ? ', $12' : ''})`,
        [
          name.trim(),
          address.trim(),
          suburb.trim(),
          email.trim().toLowerCase(),
          emailHash,
          phone.trim(),
          timeline || null,
          motivation || null,
          language || null,
          heard_from || null,
          priority,
          ...(useAlertColumn ? ['pending'] : []),
        ]
      );
      // Reset cache so next request re-checks (in case migration runs soon)
      hasLocationColumns = null;
    }

    // Update tracking for direct mail campaigns
    await updateAppraisalTracking(address.trim(), suburb.trim()).catch(err => {
      console.error("Failed to update appraisal tracking:", err);
    });

    // Update outreach status from 'interacted' to 'converted'
    try {
      const outreachResult = await marieDB.query(
        `SELECT id, status FROM outreach_properties 
         WHERE property_address ILIKE $1 
         AND suburb ILIKE $2 
         AND status IN ('sent', 'interacted')
         ORDER BY created_at DESC
         LIMIT 1`,
        [`%${address.trim()}%`, suburb.trim()]
      );

      const outreachRows = Array.isArray((outreachResult as { rows?: Array<{ id: string; status: string }> } | null | undefined)?.rows)
        ? (outreachResult as { rows: Array<{ id: string; status: string }> }).rows
        : [];

      if (outreachRows.length > 0) {
        const outreachProperty = outreachRows[0];
        if (outreachProperty.status === 'interacted') {
          await marieDB.query(
            `UPDATE outreach_properties 
             SET status = 'converted', 
                 converted_at = NOW() 
             WHERE id = $1`,
            [outreachProperty.id]
          );
          console.log(`✅ Updated outreach property ${outreachProperty.id} to 'converted' status (appraisal booked)`);
        } else if (outreachProperty.status === 'sent') {
          await marieDB.query(
            `UPDATE outreach_properties 
             SET status = 'interacted', 
                 interacted_at = NOW() 
             WHERE id = $1`,
            [outreachProperty.id]
          );
          console.log(`✅ Updated outreach property ${outreachProperty.id} to 'interacted' status (direct to appraisal)`);
        }
      }
    } catch (err) {
      console.error('Failed to update outreach status:', err);
    }

    const languagePreference = language?.trim() || undefined;
    const heardFrom = heard_from?.trim() || undefined;

    sendAppraisalNotification({
      name: name.trim(),
      address: address.trim(),
      email: email.trim(),
      phone: phone.trim(),
      suburb: suburb.trim(),
      region: resolvedRegion || undefined,
      city: resolvedCity || undefined,
      timeline,
      motivation,
      languagePreference,
      heardFrom,
      submittedAt: new Date(),
    }).catch(err => console.error("Email send failed:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Appraisal API Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
