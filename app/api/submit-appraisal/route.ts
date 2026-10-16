import { NextResponse } from "next/server";
import { marieDB } from "@/lib/db";
import { findLocationBySuburb } from "@/lib/geo-data";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const {
      name,
      email,
      phone,
      property_address,
      address,
      suburb,
      message,
      source,
      utmSource,
      region,
      city,
    } = body as Record<string, string | undefined>;

    const propertyAddress =
      typeof property_address === "string" && property_address.trim()
        ? property_address.trim()
        : typeof address === "string" && address.trim()
        ? address.trim()
        : null;
    const sourceValue =
      typeof source === "string" && source.trim()
        ? source.trim()
        : typeof utmSource === "string" && utmSource.trim()
        ? utmSource.trim()
        : "website";
    const suburbValue =
      typeof suburb === "string" && suburb.trim() ? suburb.trim() : "Unknown";

    let resolvedRegion = typeof region === "string" && region.trim() ? region.trim() : null;
    let resolvedCity = typeof city === "string" && city.trim() ? city.trim() : null;

    if (!resolvedRegion || !resolvedCity) {
      const location = findLocationBySuburb(suburbValue);
      if (location) {
        resolvedRegion = resolvedRegion || location.region;
        resolvedCity = resolvedCity || location.city;
      }
    }

    // Validation
    if (!name || !email || !propertyAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, email, address",
        },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Insert into appraisal_leads table
    const result = await marieDB.query(
      `INSERT INTO appraisal_leads 
       (name, email, phone, property_address, suburb, region, city, message, source, contact_status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', 'medium')
       RETURNING *`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        phone?.trim() || null,
        propertyAddress,
        suburbValue,
        resolvedRegion,
        resolvedCity,
        typeof message === "string" ? message.trim() : null,
        sourceValue,
      ]
    );

    const lead = result.rows[0];

    // Update outreach status from 'interacted' to 'converted'
    try {
      const outreachResult = await marieDB.query(
        `SELECT id, status FROM outreach_properties 
         WHERE property_address ILIKE $1 
         AND suburb ILIKE $2 
         AND status IN ('sent', 'interacted')
         ORDER BY created_at DESC
         LIMIT 1`,
        [`%${propertyAddress}%`, suburbValue]
      );

      if (outreachResult.rows.length > 0) {
        const outreachProperty = outreachResult.rows[0];
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

    return NextResponse.json({
      success: true,
      lead,
      message: "Appraisal request submitted successfully",
    });
  } catch (error) {
    console.error("Submit appraisal error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit appraisal request" },
      { status: 500 }
    );
  }
}
