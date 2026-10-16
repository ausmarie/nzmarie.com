import { query } from './db';

export type StreetProgressStatus = 'in_progress' | 'completed';

export interface StreetProgressEntry {
  suburb: string;
  street: string;
  status: StreetProgressStatus;
  liked_count: number;
  completed_at: string | null;
  updated_at: string | null;
}

export async function getStreetProgress(suburb: string): Promise<Record<string, StreetProgressEntry>> {
  const result = await query<{
    street: string;
    status: StreetProgressStatus;
    liked_count: number;
    completed_at: string | null;
    updated_at: string | null;
  }>(
    `SELECT street, status, liked_count, completed_at, updated_at
     FROM admin_street_progress
     WHERE LOWER(suburb) = LOWER($1)
     ORDER BY street ASC`,
    [suburb]
  );
  const out: Record<string, StreetProgressEntry> = {};
  for (const r of result.rows || []) {
    out[r.street] = {
      suburb,
      street: r.street,
      status: r.status === 'completed' ? 'completed' : 'in_progress',
      liked_count: Number(r.liked_count) || 0,
      completed_at: r.completed_at,
      updated_at: r.updated_at,
    };
  }
  return out;
}

export interface SetStreetProgressInput {
  suburb: string;
  street: string;
  status: StreetProgressStatus;
  likedCount?: number;
  email: string;
}

export async function setStreetProgress({ suburb, street, status, likedCount, email }: SetStreetProgressInput): Promise<StreetProgressEntry> {
  const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
  const result = await query<{
    suburb: string;
    street: string;
    status: StreetProgressStatus;
    liked_count: number;
    completed_at: string | null;
    updated_at: string | null;
  }>(
    `INSERT INTO admin_street_progress (suburb, street, status, liked_count, completed_at, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, ${completedAt}, NOW(), $5)
     ON CONFLICT (suburb, street)
     DO UPDATE SET
       status = EXCLUDED.status,
       liked_count = EXCLUDED.liked_count,
       completed_at = ${completedAt},
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING suburb, street, status, liked_count, completed_at, updated_at`,
    [suburb, street, status, Number(likedCount) || 0, email]
  );
  const r = result.rows[0];
  return {
    suburb: r.suburb,
    street: r.street,
    status: r.status === 'completed' ? 'completed' : 'in_progress',
    liked_count: Number(r.liked_count) || 0,
    completed_at: r.completed_at,
    updated_at: r.updated_at,
  };
}