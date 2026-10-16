import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();
  
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { contact_status, priority, agent_notes, follow_up_at } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (contact_status) {
      updates.push(`contact_status = $${paramIndex}`);
      values.push(contact_status);
      paramIndex++;
    }

    if (priority) {
      updates.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }

    if (agent_notes !== undefined) {
      updates.push(`agent_notes = $${paramIndex}`);
      values.push(agent_notes);
      paramIndex++;
    }

    if (follow_up_at) {
      updates.push(`follow_up_at = $${paramIndex}`);
      values.push(follow_up_at);
      paramIndex++;
    }

    updates.push(`last_contact_at = NOW()`);
    updates.push(`updated_at = NOW()`);

    values.push(params.id);

    const query = `
      UPDATE appraisal_leads
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await marieDB.query(query, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}
