import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const tableName = body.listing_type === 'rent' ? 'real_estate_rent' : 'real_estate';

  const allowedColumns = [
    'price_display', 'agent_name', 'status',
    'address', 'region', 'suburb', 'city', 'bedroom_count', 'bathroom_count',
    'land_area', 'floor_area', 'car_spaces', 'property_url', 'cover_image_url',
    'property_type', 'description', 'listing_number',
    'last_sold_date', 'property_history',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const col of allowedColumns) {
    if (body[col] !== undefined) {
      updates.push(`${col} = $${idx}`);
      values.push(body[col] === '' ? null : body[col]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  values.push(id);
  const sql = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${idx}`;

  try {
    await marieQuery(sql, values);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating realestate listing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update listing' },
      { status: 500 }
    );
  }
}
