import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { matchPropertyIdByAddress, normalizePropertyStreetAddress } from '@/lib/lead-property';
import { resolvePriority, timelineLabel } from '@/lib/priority';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const appraisalResult = await marieDB.query(
      `SELECT id, client_name, property_address, suburb, region, city,
              email, phone, timeline, priority, priority_source, motivation,
              language_preference, heard_from, lead_id
       FROM appraisal_leads
       WHERE id = $1`,
      [params.id]
    );

    if (appraisalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    const appraisal = appraisalResult.rows[0];

    if (appraisal.lead_id) {
      return NextResponse.json({ success: true, leadId: appraisal.lead_id, alreadyConverted: true });
    }

    // Manual overrides win; otherwise priority is derived from the timeline so
    // the appraisal and the converted lead always agree.
    const priority = resolvePriority(appraisal.timeline, appraisal.priority, appraisal.priority_source);
    const summary = `Appraisal request — timeline: ${timelineLabel(appraisal.timeline)}`;

    const notesParts = [
      appraisal.motivation ? `Motivation: ${appraisal.motivation}` : null,
      appraisal.language_preference ? `Language: ${appraisal.language_preference}` : null,
      appraisal.heard_from ? `Heard from: ${appraisal.heard_from}` : null,
    ].filter(Boolean);
    const notes = notesParts.length > 0 ? notesParts.join('\n') : null;

    const propertyId = await matchPropertyIdByAddress(appraisal.property_address, appraisal.suburb);
    const propertyAddress = normalizePropertyStreetAddress(appraisal.property_address);

    const leadResult = await marieDB.query(
      `INSERT INTO leads (property_address, property_id, suburb, city, region, owner_name, owner_email, owner_phone,
                          source, status, priority, summary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'appraisal', 'new', $9, $10, $11)
       RETURNING id`,
      [
        propertyAddress,
        propertyId,
        appraisal.suburb || null,
        appraisal.city || null,
        appraisal.region || null,
        appraisal.client_name,
        appraisal.email,
        appraisal.phone || null,
        priority,
        summary,
        notes,
      ]
    );

    const leadId = leadResult.rows[0].id;

    await marieDB.query(
      `INSERT INTO lead_events (lead_id, event_type, title, description, created_by)
       VALUES ($1, 'appraisal_converted', 'Appraisal converted to lead',
               'Lead created from homepage Book Appraisal submission.', $2)`,
      [leadId, session.user.email]
    );

    await marieDB.query(
      `UPDATE appraisal_leads
       SET lead_id = $1, alert_status = 'resolved', alert_converted_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [leadId, params.id]
    );

    return NextResponse.json({ success: true, leadId });
  } catch (error) {
    console.error('Error converting appraisal to lead:', error);
    return NextResponse.json({ error: 'Failed to convert appraisal to lead' }, { status: 500 });
  }
}
