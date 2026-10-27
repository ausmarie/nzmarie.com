import { query as marieQuery } from '@/lib/db';
import {
  applyLeadIntroductionComparableProps,
  buildLeadIntroductionBlocks,
  buildLeadIntroductionComparableProps,
  buildLeadIntroductionTitle,
  type LeadIntroductionProperty,
} from '@/lib/lead-introduction';

type LeadIntroductionRow = LeadIntroductionProperty & { lead_id: string };

const LEAD_PROPERTY_SQL = `
       l.id AS lead_id,
       COALESCE(NULLIF(l.property_address, ''), p.address) AS address,
       COALESCE(NULLIF(l.suburb, ''), p.suburb) AS suburb,
       COALESCE(NULLIF(l.city, ''), p.city) AS city,
       COALESCE(NULLIF(l.region, ''), p.region) AS region,
       p.bedrooms,
       p.bathrooms,
       p.car_spaces,
       p.floor_size,
       p.land_area,
       p.land_area_numeric,
       p.property_type,
       p.year_built,
       p.capital_value,
       p.land_value,
       p.improvement_value,
       p.estimated_value_low,
       p.estimated_value_high,
       p.last_sold_price,
       p.last_sold_date,
       p.has_rental_history,
       p.is_currently_rented,
       p.description,
       p.property_history
`;

export async function ensureLeadIntroduction(leadId: string, userId: string): Promise<string | null> {
  const existing = await marieQuery<{ id: string; content: unknown }>(
    `SELECT id, content FROM report_documents
     WHERE lead_id = $1 AND doc_type = 'lead_intro' AND status != 'archived'
     ORDER BY created_at ASC
     LIMIT 1`,
    [leadId]
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    let content = row.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch { content = null; }
    }
    if (!Array.isArray(content)) return row.id;

    const hasPlaceholder = content.some((block) => {
      if (!block || typeof block !== 'object' || (block as { type?: string }).type !== 'comparableSummary') return false;
      const props = (block as { props?: Record<string, string> }).props ?? {};
      return Object.values(props).includes('\u2014');
    });
    if (!hasPlaceholder) return row.id;

    const propertyResult = await marieQuery<LeadIntroductionRow>(
      `SELECT ${LEAD_PROPERTY_SQL}
       FROM leads l
       LEFT JOIN properties p ON REPLACE(l.property_id::text, '-', '') = p.id
       WHERE l.id = $1
       LIMIT 1`,
      [leadId]
    );
    const property = propertyResult.rows[0];
    if (!property) return row.id;
    const changes = buildLeadIntroductionComparableProps(property);
    const updatedContent = changes ? applyLeadIntroductionComparableProps(content, changes) : null;
    if (!updatedContent) return row.id;

    await marieQuery(
      `UPDATE report_documents SET content = $2, updated_at = NOW() WHERE id = $1`,
      [row.id, JSON.stringify(updatedContent)]
    );
    return row.id;
  }

  const result = await marieQuery<LeadIntroductionRow>(
    `SELECT ${LEAD_PROPERTY_SQL}
     FROM leads l
     LEFT JOIN properties p ON REPLACE(l.property_id::text, '-', '') = p.id
     WHERE l.id = $1
     LIMIT 1`,
    [leadId]
  );

  const property = result.rows[0];
  const address = property?.address?.trim();
  if (!property || !address) return null;

  const content = buildLeadIntroductionBlocks({ ...property, address });
  const comparableChanges = buildLeadIntroductionComparableProps(property);
  const populatedContent = comparableChanges
    ? applyLeadIntroductionComparableProps(content, comparableChanges) ?? content
    : content;
  const inserted = await marieQuery<{ id: string }>(
    `INSERT INTO report_documents (user_id, doc_type, quarter, title, content, lead_id, sort_order)
     VALUES ($1, 'lead_intro', NULL, $2, $3, $4, -1)
     RETURNING id`,
    [userId, buildLeadIntroductionTitle(address), JSON.stringify(populatedContent), leadId]
  );
  return inserted.rows[0]?.id ?? null;
}

export async function ensureAllLeadIntroductions(userId: string): Promise<number> {
  const result = await marieQuery<{ id: string }>(
    `SELECT l.id
     FROM leads l
     WHERE NOT EXISTS (
       SELECT 1 FROM report_documents rd
       WHERE rd.lead_id = l.id AND rd.doc_type = 'lead_intro' AND rd.status != 'archived'
     )
     ORDER BY l.created_at DESC`
  );

  let created = 0;
  for (const row of result.rows) {
    try {
      const id = await ensureLeadIntroduction(row.id, userId);
      if (id) created += 1;
    } catch (error) {
      console.error('Failed to create lead introduction:', row.id, error);
    }
  }
  return created;
}
