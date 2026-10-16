import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';
import { isSuperAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
  
  // Only Louis can access analytics
  if (!session?.user?.email || !isSuperAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await marieDB.query(`
      SELECT 
        dma.suburb,
        COUNT(DISTINCT dma.id) as total_mailed,
        COUNT(DISTINCT dma.id) FILTER (WHERE dma.has_downloaded) as downloads,
        COUNT(DISTINCT dma.id) FILTER (WHERE dma.has_requested_appraisal) as appraisals,
        COUNT(DISTINCT dma.id) FILTER (WHERE dma.is_converted) as conversions,
        SUM(dma.conversion_value) FILTER (WHERE dma.is_converted) as revenue,
        SUM(c.printing_cost + c.postage_cost) / NULLIF(COUNT(DISTINCT c.id), 0) as avg_cost_per_campaign,
        CASE 
          WHEN SUM(c.printing_cost + c.postage_cost) > 0 THEN
            ROUND(
              ((SUM(dma.conversion_value) FILTER (WHERE dma.is_converted) - SUM(c.printing_cost + c.postage_cost)) / 
              NULLIF(SUM(c.printing_cost + c.postage_cost), 0)) * 100,
              1
            )
          ELSE 0
        END as roi_percentage
      FROM direct_mail_addresses dma
      LEFT JOIN direct_mail_campaigns c ON dma.campaign_id = c.id
      GROUP BY dma.suburb
      ORDER BY roi_percentage DESC NULLS LAST
    `);

    return NextResponse.json({
      suburbs: result.rows.map(row => ({
        suburb: row.suburb,
        total_mailed: parseInt(row.total_mailed) || 0,
        downloads: parseInt(row.downloads) || 0,
        appraisals: parseInt(row.appraisals) || 0,
        conversions: parseInt(row.conversions) || 0,
        revenue: parseFloat(row.revenue) || 0,
        avg_cost_per_campaign: parseFloat(row.avg_cost_per_campaign) || 0,
        roi_percentage: parseFloat(row.roi_percentage) || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching suburb analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suburb analytics' },
      { status: 500 }
    );
  }
}
