// lib/download-tracker.ts
// Download tracking with 5 downloads/month limit per email+suburb

import { marieDB } from './db';

export interface DownloadLimitCheck {
  canDownload: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  message: string;
  resetDate: Date;
}

export interface RecordDownloadParams {
  email: string;
  name?: string;
  phone?: string;
  suburb: string;
  reportType?: string;
  source?: string;
  campaignId?: string;
  trackingCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Check if user can download report (5 times per month per email+suburb)
 */
export async function checkDownloadLimit(
  email: string,
  suburb: string
): Promise<DownloadLimitCheck> {
  const result = await marieDB.query(
    `SELECT check_download_limit($1, $2) as result`,
    [email, suburb]
  );
  
  return result.rows[0].result;
}

/**
 * Record a download with limit checking
 */
export async function recordDownload(params: RecordDownloadParams) {
  // First check if limit is reached
  const limitCheck = await checkDownloadLimit(params.email, params.suburb);
  
  if (!limitCheck.canDownload) {
    throw new Error(`Download limit exceeded: ${limitCheck.message}`);
  }
  
  // Record the download
  const result = await marieDB.query(
    `INSERT INTO report_downloads 
     (email, name, phone, suburb, report_type, source, campaign_id, tracking_code, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.email,
      params.name || null,
      params.phone || null,
      params.suburb,
      params.reportType || 'local_market',
      params.source || 'organic',
      params.campaignId || null,
      params.trackingCode || null,
      params.ipAddress || null,
      params.userAgent || null,
    ]
  );
  
  return result.rows[0];
}

/**
 * Get download stats for a user
 */
export async function getUserDownloadStats(email: string, suburb?: string) {
  let query = `
    SELECT 
      email,
      suburb,
      COUNT(*) as total_downloads,
      MIN(downloaded_at) as first_download,
      MAX(downloaded_at) as last_download,
      COUNT(*) FILTER (
        WHERE downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)
      ) as downloads_this_month
    FROM report_downloads
    WHERE email = $1
  `;
  
  const params: string[] = [email];
  
  if (suburb) {
    query += ` AND suburb = $2`;
    params.push(suburb);
  }
  
  query += ` GROUP BY email, suburb`;
  
  const result = await marieDB.query(query, params);
  return result.rows;
}
