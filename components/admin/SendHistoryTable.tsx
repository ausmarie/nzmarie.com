import React from 'react';
import { FaQrcode } from 'react-icons/fa';
import { parsePeriodParts, periodLabel } from '@/lib/report-period';

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

function formatSentPeriod(campaignKey: string, sentAt: string): string {
  const campaignPeriodKey = campaignKey.match(
    /^(\d{4}[-_](?:Q[1-4]|M(?:0[1-9]|1[0-2])|(?:0[1-9]|1[0-2])))(?:[_-]|$)/i
  )?.[1];
  const campaignPeriod = parsePeriodParts(campaignPeriodKey);
  if (campaignPeriod) return campaignPeriod.label;

  const date = new Date(sentAt);
  const parts = new Intl.DateTimeFormat('en-NZ', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Pacific/Auckland',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return periodLabel(Number(year), `Q${Math.ceil(Number(month) / 3)}`);
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
        gridTemplateColumns: '100px 150px 1fr 100px 80px',
        backgroundColor: '#edf2f7',
        fontWeight: '700',
        color: '#4a5568',
        padding: '8px 12px',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.75rem',
      }}>
        <span>Quarter / Month</span>
        <span>Sent Date &amp; Time</span>
        <span>Report / Campaign</span>
        <span>Sent By</span>
        <span style={{ textAlign: 'center' }}>Scans</span>
      </div>
      {history.map((log, i) => {
        const sentPeriod = formatSentPeriod(log.campaign_key, log.sent_at);
        const sentDateTime = new Date(log.sent_at).toLocaleString('en-NZ', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Pacific/Auckland',
        });
        return (
          <div
            key={log.log_id || i}
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 150px 1fr 100px 80px',
              padding: '8px 12px',
              borderBottom: i < history.length - 1 ? '1px solid #edf2f7' : 'none',
              color: '#2D3748',
              alignItems: 'center',
              backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff',
            }}
          >
            <span style={{ fontWeight: '600', color: '#2563eb', fontSize: '0.75rem' }}>
              {sentPeriod}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {sentDateTime}
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