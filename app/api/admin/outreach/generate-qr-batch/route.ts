import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getOrCreateQRToken, buildQRUrl } from '@/lib/qr-token';
import { marieDB } from '@/lib/db';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await marieDB.ensureOutreachTablesExist?.();
    const body = await request.json() as { property_ids?: string[] };
    const { property_ids } = body;

    if (!property_ids || !Array.isArray(property_ids) || property_ids.length === 0) {
      return NextResponse.json(
        { error: 'property_ids array is required' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      property_ids.map(async (id: string) => {
        try {
          const propertyResult = await marieDB.query(
            `SELECT id, property_address, suburb FROM outreach_properties WHERE id = $1`,
            [id]
          );

          if (propertyResult.rows.length === 0) {
            return { id, error: 'Property not found' };
          }

          const property = propertyResult.rows[0];
          const token = await getOrCreateQRToken(id);
          const url = buildQRUrl(token);

          return {
            id,
            property_address: property.property_address,
            suburb: property.suburb,
            token,
            url,
            qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
          };
        } catch (error) {
          console.error(`Error generating QR for property ${id}:`, error);
          return { id, error: 'Failed to generate QR' };
        }
      })
    );

    const successful = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    return NextResponse.json({
      success: true,
      generated: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error('Error generating QR batch:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR codes' },
      { status: 500 }
    );
  }
}
