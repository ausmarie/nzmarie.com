import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await marieDB.query(`
      CREATE TABLE IF NOT EXISTS suburb_qr_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        suburb VARCHAR(100) NOT NULL,
        target_url VARCHAR(500) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(200) NOT NULL,
        file_size INT DEFAULT 0,
        uploaded_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(suburb)
      )
    `);

    const result = await marieDB.query(
      'SELECT id, suburb, target_url, file_url, file_name, file_size, uploaded_by, created_at FROM suburb_qr_codes ORDER BY suburb ASC'
    );

    return NextResponse.json({
      success: true,
      qrcodes: result.rows,
    });
  } catch (error) {
    console.error('Error listing QR codes:', error);
    return NextResponse.json(
      { error: 'Failed to list QR codes' },
      { status: 500 }
    );
  }
}
