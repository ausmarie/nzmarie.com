import { query } from './db';

export async function checkDownloadLimit(emailHash: string, limit: number = 5, windowDays: number = 30): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM report_download_events
     WHERE email_hash = $1
       AND created_at >= now() - ($2::text || ' days')::interval
       AND status != 'failed'`,
    [emailHash, windowDays]
  );
  const count = Number(result.rows[0].count);
  return count < limit;
}
