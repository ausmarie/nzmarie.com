import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { SUBURB_PRIORITY_ORDER } from '@/lib/suburb-order';

const SUBURB_ORDER = ['North Shore', ...SUBURB_PRIORITY_ORDER];

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    type OverviewRow = {
      suburb_id: string;
      suburb_name: string;
      doc_id: string | null;
      doc_type: string | null;
      title: string | null;
      quarter: string | null;
      status: string | null;
      created_at: string | null;
    };

    const result = await marieQuery<OverviewRow>(
      `SELECT
        rs.id AS suburb_id,
        rs.name AS suburb_name,
        rd.id AS doc_id,
        rd.doc_type,
        rd.title,
        rd.quarter,
        rd.status,
        rd.created_at
      FROM report_suburbs rs
      LEFT JOIN report_documents rd ON rd.suburb_id = rs.id AND rd.status != 'archived'
      WHERE rs.is_active = TRUE
      ORDER BY rd.sort_order ASC, rd.created_at DESC`
    );

    const suburbMap = new Map<string, {
      id: string;
      name: string;
      introDoc: { id: string; title: string; status: string } | null;
      letterDoc: { id: string; title: string; status: string } | null;
      reports: Array<{ id: string; title: string; quarter: string; status: string; createdAt: string }>;
    }>();

    for (const row of result.rows) {
      if (!suburbMap.has(row.suburb_id)) {
        suburbMap.set(row.suburb_id, {
          id: row.suburb_id,
          name: row.suburb_name,
          introDoc: null,
          letterDoc: null,
          reports: [],
        });
      }
      if (!row.doc_id) continue;
      const entry = suburbMap.get(row.suburb_id)!;
      if (row.doc_type === 'suburb_intro') {
        if (!entry.introDoc) {
          entry.introDoc = { id: row.doc_id, title: row.title ?? '', status: row.status ?? 'draft' };
        }
      } else if (row.doc_type === 'letter') {
        if (!entry.letterDoc) {
          entry.letterDoc = { id: row.doc_id, title: row.title ?? '', status: row.status ?? 'draft' };
        }
      } else if (row.doc_type === 'report') {
        entry.reports.push({
          id: row.doc_id,
          title: row.title ?? '',
          quarter: row.quarter || '',
          status: row.status ?? 'draft',
          createdAt: row.created_at ?? '',
        });
      }
    }

    const orderMap = new Map(SUBURB_ORDER.map((s, i) => [s, i]));
    const suburbs = Array.from(suburbMap.values())
      .sort((a, b) => {
        const ai = orderMap.get(a.name) ?? SUBURB_ORDER.length;
        const bi = orderMap.get(b.name) ?? SUBURB_ORDER.length;
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      success: true,
      region: { name: 'North Shore' },
      suburbs,
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch overview' }, { status: 500 });
  }
}
