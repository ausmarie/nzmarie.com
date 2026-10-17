import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'mock-resend-api-key');

const ALERT_RECIPIENTS = ['nzmarie.com@gmail.com', 'nzlouis.com@gmail.com'];

const TIMELINE_LABELS: Record<string, string> = {
  'within-3-months': 'Within 3 months',
  '3-6-months': '3–6 months',
  '6-12-months': '6–12 months',
  'just-exploring': 'Just exploring',
};

const MOTIVATION_LABELS: Record<string, string> = {
  upsizing: 'Upsizing',
  downsizing: 'Downsizing',
  investment: 'Investment',
  relocating: 'Relocating',
  estate: 'Estate',
  other: 'Other',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
};

const HEARD_FROM_LABELS: Record<string, string> = {
  google: 'Google',
  wechat: 'WeChat',
  referral: 'Referral',
  facebook: 'Facebook',
  other: 'Other',
};

export interface SendAppraisalEmailParams {
  name: string;
  address: string;
  email: string;
  phone: string;
  suburb?: string;
  region?: string;
  city?: string;
  timeline?: string;
  motivation?: string;
  languagePreference?: string;
  heardFrom?: string;
  submittedAt?: Date;
}

function label(map: Record<string, string>, value?: string) {
  if (!value) return 'Not provided';
  return map[value] ?? value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nzTime(date: Date) {
  return date.toLocaleString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export async function sendAppraisalNotification(params: SendAppraisalEmailParams) {
  const from = 'Marie Zhang - nzmarie.com <noreply@nzmarie.com>';
  const to = ALERT_RECIPIENTS;
  const subject = `New Appraisal Request: ${params.address} — ${params.name}`;

  const submittedAt = params.submittedAt ?? new Date();
  const crmUrl = `${process.env.NEXTAUTH_URL || 'https://nzmarie.com'}/admin/activity?tab=appraisals&search=${encodeURIComponent(params.email)}`;

  const location = [params.suburb, params.city, params.region].filter(Boolean).join(', ');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">New Appraisal Request</h1>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 40%;">Name</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${escapeHtml(params.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Property Address</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${escapeHtml(params.address)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Location</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${location ? escapeHtml(location) : 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <a href="mailto:${escapeHtml(params.email)}" style="color: #2563eb;">${escapeHtml(params.email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Phone</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${escapeHtml(params.phone)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Timeline</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${label(TIMELINE_LABELS, params.timeline)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Motivation</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${label(MOTIVATION_LABELS, params.motivation)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Language Preference</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${label(LANGUAGE_LABELS, params.languagePreference)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Heard From</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${label(HEARD_FROM_LABELS, params.heardFrom)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Submitted At</td>
          <td style="padding: 8px 0;">${nzTime(submittedAt)} (NZ time)</td>
        </tr>
      </table>
      <p style="margin: 24px 0 8px;">
        <a href="${crmUrl}"
           style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none;
                  padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;">
          View in CRM
        </a>
      </p>
      <p style="font-size: 12px; color: #9ca3af; margin: 8px 0 0;">
        This request has been added to the appraisal alerts in the admin CRM.
      </p>
    </div>
  `;

  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'mock-resend-api-key') {
    return resend.emails.send({
      from,
      to,
      subject,
      html,
    });
  } else {
    console.log('Using mock Resend, email content:', html);
    return { id: 'mock-email-id' };
  }
}
