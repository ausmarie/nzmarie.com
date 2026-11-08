import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureQuarterDispatchJunkSchema, marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { invalidateDashboardStatsCache, invalidateStreetClustersForSuburb } from '@/lib/redis';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    await ensureQuarterDispatchJunkSchema();
    const body = await request.json();
    const { id } = await params;

    const noJunkMailValue = body.no_junk_mail;
    const hasNoJunkMail = noJunkMailValue !== undefined;
    const hasQuarterContext =
      body.quarter !== undefined || body.year !== undefined || body.suburb_report_id !== undefined;

    if (hasNoJunkMail && typeof noJunkMailValue !== 'boolean') {
      return NextResponse.json({ error: 'no_junk_mail must be a boolean' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowedFields = [
      'status',
      'sent_at',
      'interacted_at',
      'converted_at',
      'owner_name',
      'property_type',
      'notes',
      'campaign',
      'property_address',
      'suburb',
      'city',
      'region',
      'street',
      'property_id',
      'louis_property_id',
    ];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    });

    if (updates.length === 0 && !hasNoJunkMail) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    let result;

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE outreach_properties
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING *
      `;

      result = await marieDB.query(query, values);
    } else {
      result = await marieDB.query(
        `SELECT * FROM outreach_properties WHERE id = $1`,
        [id]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const updatedProperty = result.rows[0];

    let quarterReportId: string | null = null;
    let quarterContext: { quarter: string; year: number; suburb: string } | null = null;
    let quarterJunkRecorded: boolean | null = null;

    if (hasNoJunkMail) {
      if (hasQuarterContext) {
        const quarter = typeof body.quarter === 'string' ? body.quarter.toUpperCase() : '';
        const year = Number(body.year);
        const suburb = typeof body.suburb === 'string' && body.suburb.trim()
          ? body.suburb.trim()
          : updatedProperty.suburb;

        if (!/^Q[1-4]$/.test(quarter) || !Number.isInteger(year) || year < 2000 || !suburb) {
          return NextResponse.json({ error: 'A valid quarter, year, and suburb are required' }, { status: 400 });
        }

        const reportResult = body.suburb_report_id
          ? await marieDB.query(
            `SELECT id
             FROM suburb_reports
             WHERE id = $1 AND suburb = $2 AND year = $3 AND quarter = $4 AND status = 'active'
             LIMIT 1`,
            [body.suburb_report_id, suburb, year, quarter]
          )
          : await marieDB.query(
            `SELECT id
             FROM suburb_reports
             WHERE suburb = $1 AND year = $2 AND quarter = $3 AND status = 'active'
             ORDER BY uploaded_at DESC
             LIMIT 1`,
            [suburb, year, quarter]
          );
        quarterReportId = reportResult.rows[0]?.id ? String(reportResult.rows[0].id) : null;

        if (!quarterReportId) {
          return NextResponse.json({ error: 'Active report not found for the selected quarter' }, { status: 404 });
        }
        quarterContext = { quarter, year, suburb };
      }

      if (quarterContext && quarterReportId) {
        const client = await marieDB.connect();
        try {
          await client.query('BEGIN');
          // Pending/map junk belongs to the report quarter currently selected
          // in the UI. Without the old send-window gate, a mark made after the
          // suburb's dispatch window still lands on that quarter's report.
          const junkReportId = quarterReportId;
          const junkSuburb = quarterContext.suburb;
          const junkQuarter = quarterContext.quarter;
          const junkYear = quarterContext.year;
          // Marking junk must always be recorded against the selected report.
          // The dashboard reads only this table for quarterly junk; the
          // address-level properties flag is just basic filtering.
          quarterJunkRecorded = noJunkMailValue;

          if (updatedProperty.property_id) {
            const pid = String(updatedProperty.property_id).replace(/-/g, '');
            await client.query(
              `UPDATE properties SET no_junk_mail = $1, no_junk_mail_updated_at = NOW() WHERE id = $2`,
              [noJunkMailValue, pid]
            );
          }
          if (updatedProperty.property_address && updatedProperty.suburb) {
            await client.query(
              `UPDATE properties SET no_junk_mail = $1, no_junk_mail_updated_at = NOW() WHERE LOWER(TRIM(address)) = LOWER(TRIM($2)) AND LOWER(TRIM(suburb)) = LOWER(TRIM($3))`,
              [noJunkMailValue, updatedProperty.property_address, updatedProperty.suburb]
            );
          }
          if (quarterJunkRecorded && junkReportId) {
            await client.query(
              `INSERT INTO outreach_property_quarter_status
                (outreach_property_id, suburb_report_id, suburb, quarter, year, is_junk, junk_at)
               VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
               ON CONFLICT (outreach_property_id, suburb_report_id) DO UPDATE SET
                 is_junk = TRUE,
                 junk_at = NOW(),
                 updated_at = NOW()`,
              [id, junkReportId, junkSuburb, junkQuarter, junkYear]
            );
          } else if (!noJunkMailValue) {
            // The flag is global, so removing it clears every quarter's junk
            // marker for this address instead of only the selected report.
            await client.query(
              `UPDATE outreach_property_quarter_status
               SET is_junk = FALSE, junk_at = NULL, updated_at = NOW()
               WHERE outreach_property_id = $1`,
              [id]
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        await invalidateDashboardStatsCache();
      } else {
        if (updatedProperty.property_id) {
          const pid = String(updatedProperty.property_id).replace(/-/g, '');
          await marieDB.query(
            `UPDATE properties SET no_junk_mail = $1, no_junk_mail_updated_at = NOW() WHERE id = $2`,
            [noJunkMailValue, pid]
          );
        }
        if (updatedProperty.property_address && updatedProperty.suburb) {
          await marieDB.query(
            `UPDATE properties SET no_junk_mail = $1, no_junk_mail_updated_at = NOW() WHERE LOWER(TRIM(address)) = LOWER(TRIM($2)) AND LOWER(TRIM(suburb)) = LOWER(TRIM($3))`,
            [noJunkMailValue, updatedProperty.property_address, updatedProperty.suburb]
          );
        }
        await invalidateDashboardStatsCache();
      }
    }

    if (updatedProperty?.suburb) {
      await invalidateStreetClustersForSuburb(updatedProperty.suburb);
    }

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({
      success: true,
      data: { ...result.rows[0], no_junk_mail: hasNoJunkMail ? noJunkMailValue : result.rows[0].no_junk_mail },
      ...(quarterJunkRecorded !== null ? { quarter_junk_recorded: quarterJunkRecorded } : {}),
    });
  } catch (error) {
    console.error('Error updating outreach property:', error);
    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const result = await marieDB.query(
      `DELETE FROM outreach_properties WHERE id = $1 RETURNING id, suburb`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const deletedSuburb = result.rows[0]?.suburb;
    if (deletedSuburb) {
      invalidateStreetClustersForSuburb(deletedSuburb).catch(() => { });
    }

    if (process.env.USE_OUTREACH_MV === 'true') {
      marieDB.query('REFRESH MATERIALIZED VIEW CONCURRENTLY outreach_enriched')
        .catch(err => console.error('MV refresh failed (non-critical):', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting outreach property:', error);
    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}
