/**
 * Tracking Utilities
 * 
 * Handles automatic tracking updates that would normally be done by database triggers.
 * CockroachDB has limited support for complex triggers, so we implement this logic
 * in the application layer instead.
 */

import { marieDB } from './db';

/**
 * Update tracking when a user downloads a report
 * 
 * Automatically updates:
 * 1. direct_mail_addresses (if tracking code matches)
 * 2. outreach_tasks (if tracking code matches)
 */
export async function updateDownloadTracking(
  email: string,
  suburb: string,
  trackingCode?: string
): Promise<void> {
  if (!trackingCode) return;

  try {
    // Update direct_mail_addresses
    await marieDB.query(`
      UPDATE direct_mail_addresses
      SET 
        has_downloaded = TRUE,
        download_count = download_count + 1,
        first_download_at = COALESCE(first_download_at, NOW()),
        last_download_at = NOW(),
        updated_at = NOW()
      WHERE tracking_code = $1
      AND has_downloaded = FALSE
    `, [trackingCode]);

    // Update outreach_tasks
    await marieDB.query(`
      UPDATE outreach_tasks
      SET 
        has_downloaded = TRUE,
        updated_at = NOW()
      WHERE tracking_code = $1
      AND has_downloaded = FALSE
    `, [trackingCode]);

  } catch (error) {
    console.error('Error updating download tracking:', error);
    // Don't throw - tracking is non-critical
  }
}

/**
 * Update tracking when a user requests an appraisal
 * 
 * Automatically updates:
 * 1. direct_mail_addresses (by address + suburb match)
 * 2. outreach_tasks (by address + suburb match)
 */
export async function updateAppraisalTracking(
  propertyAddress: string,
  suburb: string
): Promise<void> {
  try {
    // Update direct_mail_addresses
    await marieDB.query(`
      UPDATE direct_mail_addresses
      SET 
        has_requested_appraisal = TRUE,
        appraisal_request_at = NOW(),
        contact_status = CASE 
          WHEN contact_status = 'not_contacted' THEN 'interested'
          ELSE contact_status
        END,
        updated_at = NOW()
      WHERE property_address = $1
      AND suburb = $2
      AND has_requested_appraisal = FALSE
    `, [propertyAddress, suburb]);

    // Update outreach_tasks
    await marieDB.query(`
      UPDATE outreach_tasks
      SET 
        has_requested_appraisal = TRUE,
        updated_at = NOW()
      WHERE property_address = $1
      AND suburb = $2
      AND has_requested_appraisal = FALSE
    `, [propertyAddress, suburb]);

  } catch (error) {
    console.error('Error updating appraisal tracking:', error);
    // Don't throw - tracking is non-critical
  }
}

/**
 * Recalculate campaign statistics
 * 
 * Updates direct_mail_campaigns with aggregated stats:
 * - download_count
 * - appraisal_count
 * - conversion_count
 * - total_revenue
 */
export async function updateCampaignStats(campaignId: string): Promise<void> {
  try {
    await marieDB.query(`
      UPDATE direct_mail_campaigns
      SET
        download_count = (
          SELECT COUNT(*) 
          FROM direct_mail_addresses 
          WHERE campaign_id = $1 AND has_downloaded = TRUE
        ),
        appraisal_count = (
          SELECT COUNT(*) 
          FROM direct_mail_addresses 
          WHERE campaign_id = $1 AND has_requested_appraisal = TRUE
        ),
        conversion_count = (
          SELECT COUNT(*) 
          FROM direct_mail_addresses 
          WHERE campaign_id = $1 AND is_converted = TRUE
        ),
        total_revenue = (
          SELECT COALESCE(SUM(conversion_value), 0)
          FROM direct_mail_addresses 
          WHERE campaign_id = $1 AND is_converted = TRUE
        ),
        updated_at = NOW()
      WHERE id = $1
    `, [campaignId]);

  } catch (error) {
    console.error('Error updating campaign stats:', error);
    throw error; // Campaign stats are critical
  }
}

/**
 * Check if user has exceeded download limit
 * 
 * Returns true if user can still download (has not exceeded 5 downloads this month)
 * Returns false if limit exceeded
 */
export async function checkDownloadLimit(
  email: string,
  suburb: string
): Promise<boolean> {
  try {
    const result = await marieDB.query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM report_downloads
      WHERE email = $1
      AND suburb = $2
      AND downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP)
    `, [email, suburb]);

    const count = parseInt(result.rows[0].count);
    return count < 5; // Maximum 5 downloads per month

  } catch (error) {
    console.error('Error checking download limit:', error);
    return true; // Allow download on error (fail open)
  }
}

/**
 * Generate unique tracking code for QR code
 * 
 * Format: DM-{timestamp}-{random}
 * Example: DM-1719720000000-abc123def
 */
export function generateTrackingCode(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `DM-${timestamp}-${random}`;
}

/**
 * Update updated_at timestamp helper
 * 
 * Since we can't use triggers for updated_at, this helper ensures
 * we always update the timestamp when modifying records.
 */
export function withUpdatedAt<T extends Record<string, unknown>>(updates: T): T & { updated_at: Date } {
  return {
    ...updates,
    updated_at: new Date(),
  };
}
