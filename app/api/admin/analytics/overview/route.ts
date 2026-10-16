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
    const [costResult, addressResult] = await Promise.all([
      marieDB.query(`
        SELECT COALESCE(SUM(printing_cost + postage_cost), 0) as total_cost
        FROM direct_mail_campaigns
      `),
      marieDB.query(`
        SELECT
          COUNT(*) as total_mailed,
          COUNT(*) FILTER (WHERE has_downloaded) as total_downloads,
          COUNT(*) FILTER (WHERE has_requested_appraisal) as total_appraisals,
          COUNT(*) FILTER (WHERE is_converted) as total_conversions,
          COALESCE(SUM(conversion_value) FILTER (WHERE is_converted), 0) as total_revenue
        FROM direct_mail_addresses
      `),
    ]);

    const cost = costResult.rows[0];
    const stats = addressResult.rows[0];
    const totalCost = parseFloat(cost.total_cost) || 0;
    const totalRevenue = parseFloat(stats.total_revenue) || 0;
    const netProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? ((netProfit / totalCost) * 100).toFixed(1) : 0;

    const totalMailed = parseInt(stats.total_mailed) || 0;
    const totalDownloads = parseInt(stats.total_downloads) || 0;
    const totalAppraisals = parseInt(stats.total_appraisals) || 0;
    const totalConversions = parseInt(stats.total_conversions) || 0;

    return NextResponse.json({
      total_cost: totalCost,
      total_revenue: totalRevenue,
      net_profit: netProfit,
      roi_percentage: parseFloat(roi as string),
      
      total_mailed: totalMailed,
      total_downloads: totalDownloads,
      total_appraisals: totalAppraisals,
      total_conversions: totalConversions,
      
      conversion_rates: {
        mail_to_download: totalMailed > 0 ? ((totalDownloads / totalMailed) * 100).toFixed(1) : '0.0',
        download_to_appraisal: totalDownloads > 0 ? ((totalAppraisals / totalDownloads) * 100).toFixed(1) : '0.0',
        appraisal_to_conversion: totalAppraisals > 0 ? ((totalConversions / totalAppraisals) * 100).toFixed(1) : '0.0',
      },
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
