import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { matchPropertyIdByAddress } from '@/lib/lead-property';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await marieDB.query(`SELECT * FROM leads WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      'property_address', 'street', 'suburb', 'city', 'region',
      'owner_name', 'owner_email', 'owner_phone',
      'status', 'priority', 'summary', 'notes',
      'next_action', 'next_action_at', 'last_contacted_at',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field] === '' ? null : body[field]);
      }
    }

    const addressTouched = body.property_address !== undefined || body.suburb !== undefined;
    if (addressTouched) {
      let currentAddress: string | null = null;
      let currentSuburb: string | null = null;
      if (body.property_address === undefined || body.suburb === undefined) {
        const current = await marieDB.query(
          `SELECT property_address, suburb FROM leads WHERE id = $1`,
          [id]
        );
        if (current.rows.length > 0) {
          currentAddress = current.rows[0].property_address;
          currentSuburb = current.rows[0].suburb;
        }
      }
      const nextAddress = body.property_address !== undefined
        ? (body.property_address || null)
        : currentAddress;
      const nextSuburb = body.suburb !== undefined
        ? (body.suburb || null)
        : currentSuburb;
      const propertyId = await matchPropertyIdByAddress(nextAddress, nextSuburb);
      updates.push(`property_id = $${idx++}`);
      values.push(propertyId);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await marieDB.query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await marieDB.query(
      `DELETE FROM leads WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
