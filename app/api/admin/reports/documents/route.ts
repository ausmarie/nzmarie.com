import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query as marieQuery } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const docType = searchParams.get('type');
  const suburbId = searchParams.get('suburb_id');
  const quarter = searchParams.get('quarter');

  try {
    let sql = `
      SELECT rd.*, rs.name as suburb_name, rs.region as suburb_region
      FROM report_documents rd
      LEFT JOIN report_suburbs rs ON rd.suburb_id = rs.id
      WHERE rd.status != 'archived'
    `;
    const params: unknown[] = [];
    let paramIdx = 0;

    if (docType) {
      paramIdx++;
      sql += ` AND rd.doc_type = $${paramIdx}`;
      params.push(docType);
    }
    if (suburbId) {
      paramIdx++;
      sql += ` AND rd.suburb_id = $${paramIdx}`;
      params.push(suburbId);
    }
    if (quarter) {
      paramIdx++;
      sql += ` AND rd.quarter = $${paramIdx}`;
      params.push(quarter);
    }

    sql += ' ORDER BY rd.sort_order ASC, rd.created_at DESC';

    const result = await marieQuery(sql, params);
    return NextResponse.json({ success: true, documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ success: false, error: 'Request body is required' }, { status: 400 });
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;

    const { doc_type, suburb_id, quarter, title, content, parent_id } = body;

    const adminResult = await marieQuery<{ id: string }>(
      `SELECT id FROM admin_users WHERE email = $1 LIMIT 1`,
      [session.user.email]
    );
    if (adminResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const userId = adminResult.rows[0].id;

    const result = await marieQuery<{ id: string }>(
      `INSERT INTO report_documents (user_id, doc_type, suburb_id, quarter, title, content, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, doc_type || 'general', suburb_id || null, quarter || null, title || 'Untitled', content ? JSON.stringify(content) : null, parent_id || null]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ success: false, error: 'Failed to create document' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ success: false, error: 'Request body is required' }, { status: 400 });
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;

    const { id, title, content, status, icon, cover_type, cover_value, sort_order, parent_id } = body;
    console.log('[Save] PUT received — id:', id, 'hasTitle:', !!title, 'hasContent:', !!content);

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 0;

    if (title !== undefined) { paramIdx++; sets.push(`title = $${paramIdx}`); params.push(title); }
    if (content !== undefined) {
      let finalContent = content;
      if (Array.isArray(content)) {
        const getBlockText = (b: { content?: unknown }): string => {
          if (!b.content) return '';
          if (typeof b.content === 'string') return b.content;
          if (Array.isArray(b.content)) {
            return b.content.map((c: unknown) => {
              if (typeof c === 'string') return c;
              if (c && typeof c === 'object' && 'text' in c && typeof (c as Record<string, unknown>).text === 'string') return (c as Record<string, unknown>).text as string;
              return '';
            }).join('');
          }
          return '';
        };
        let targetIdx = -1;
        for (let i = 0; i < content.length; i++) {
          if (content[i]?.type === 'heading' && getBlockText(content[i]) === 'Northcross Region Trends') {
            targetIdx = i;
            break;
          }
        }
        if (targetIdx !== -1) {
          const hasAlready = content.some((b: { type?: string; content?: unknown }) => b?.type === 'heading' && getBlockText(b) === 'Northcross Quarterly Data');
          if (!hasAlready) {
            const newBlock = {
              id: '762f28ea-8b43-4a1d-a379-994df5684771',
              type: 'heading',
              props: {
                textColor: 'default',
                backgroundColor: 'default',
                textAlignment: 'left',
                level: 2
              },
              content: [
                {
                  type: 'text',
                  text: 'Northcross Quarterly Data',
                  styles: {}
                }
              ],
              children: []
            };
            const updated = [...content];
            updated.splice(targetIdx, 0, newBlock);
            finalContent = updated;
          }
        }
      }
      paramIdx++;
      sets.push(`content = $${paramIdx}`);
      params.push(JSON.stringify(finalContent));
    }
    if (status !== undefined) { paramIdx++; sets.push(`status = $${paramIdx}`); params.push(status); }
    if (icon !== undefined) { paramIdx++; sets.push(`icon = $${paramIdx}`); params.push(icon); }
    if (cover_type !== undefined) { paramIdx++; sets.push(`cover_type = $${paramIdx}`); params.push(cover_type); }
    if (cover_value !== undefined) { paramIdx++; sets.push(`cover_value = $${paramIdx}`); params.push(cover_value); }
    if (sort_order !== undefined) { paramIdx++; sets.push(`sort_order = $${paramIdx}`); params.push(sort_order); }
    if (parent_id !== undefined) { paramIdx++; sets.push(`parent_id = $${paramIdx}`); params.push(parent_id); }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    paramIdx++;
    sets.push(`updated_at = NOW()`);
    params.push(id);

    console.log('[Save] PUT executing UPDATE — id:', id, 'sets:', sets.length);
    const updateResult = await marieQuery<{ updated_at: string }>(
      `UPDATE report_documents SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING updated_at`,
      params
    );
    const updatedAt = updateResult.rows[0]?.updated_at
      ? new Date(String(updateResult.rows[0].updated_at)).getTime()
      : null;
    console.log('[Save] PUT success — id:', id, 'updated_at:', updatedAt);

    return NextResponse.json({ success: true, updated_at: updatedAt });
  } catch (error) {
    console.error('[Save] PUT error —', error);
    return NextResponse.json({ success: false, error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  try {
    await marieQuery(`DELETE FROM report_documents WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete document' }, { status: 500 });
  }
}
