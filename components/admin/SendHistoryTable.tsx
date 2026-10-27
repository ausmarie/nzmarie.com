import React from 'react';
import { FaQrcode } from 'react-icons/fa';

interface SendHistoryLog {
  log_id: string;
  outreach_property_id: string;
  suburb_report_id?: string | null;
  report_title: string;
  campaign_key: string;
  suburb: string;
  sent_at: string;
  sent_by: string;
  notes?: string | null;
  pdf_file_url?: string | null;
  pdf_file_name?: string | null;
  scan_count: number;
}

interface SendHistoryTableProps {
  history: SendHistoryLog[] | null;
}

/**
 * Extract quarter from campaign_key or sent_at date
 * Expected formats: "2026_Q2_Torbay", "2026_Q3_Northcote", etc.
 */
function extractQuarter(campaignKey: string, sentAt: string): string {
  // Try to extract from campaign_key first (format: YYYY_QX_Suburb)
  const campaignMatch = campaignKey.match(/(\d{4})_Q([1-4])/i);
  if (campaignMatch) {
    return `${campaignMatch[1]}-Q${campaignMatch[2]}`;
  }
  // Fallback: derive from sent_at date
  const date = new Date(sentAt);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

export function SendHistoryTable({ history }: SendHistoryTableProps) {
  if (!history || history.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        border: '2px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#a0aec0',
        backgroundColor: '#f8fafc',
        textAlign: 'center',
      }}>
        No send history available for this address
      </div>
    );
  }

  return (
    <div style={{
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden',
      fontSize: '0.8rem',
      backgroundColor: '#f8fafc',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 90px 1fr 100px 80px',
        backgroundColor: '#edf2f7',
        fontWeight: '700',
        color: '#4a5568',
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.75rem',
      }}>
        <span>Quarter</span>
        <span>Sent Date</span>
        <span>Report / Campaign</span>
        <span>Sent By</span>
        <span style={{ textAlign: 'center' }}>Scans</span>
      </div>
      {history.map((log, i) => {
        const quarter = extractQuarter(log.campaign_key, log.sent_at);
        const sentDate = new Date(log.sent_at).toLocaleDateString('en-NZ', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        return (
          <div
            key={log.log_id || i}
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 90px 1fr 100px 80px',
              padding: '8px 12px',
              borderBottom: i < history.length - 1 ? '1px solid #edf2f7' : 'none',
              color: '#2D3748',
              alignItems: 'center',
              backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff',
            }}
          >
            <span style={{ fontWeight: '600', color: '#2563eb', fontSize: '0.75rem' }}>
              {quarter}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {sentDate}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {log.report_title}
              </p>
              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                {log.campaign_key}
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#475569' }}>
              {log.sent_by}
            </span>
            <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {log.scan_count > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                }}>
                  <FaQrcode size={10} />
                  {log.scan_count}
                </span>
              )}
              {log.scan_count === 0 && (
                <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SendHistoryTable;