import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'mock-resend-api-key');

export interface SendAppraisalEmailParams {
  name: string;
  address: string;
  email: string;
  phone: string;
  timeline?: string;
  motivation?: string;
  languagePreference?: string;
  heardFrom?: string;
}

export async function sendAppraisalNotification(params: SendAppraisalEmailParams) {
  const from = 'Marie Zhang - nzmarie.com <noreply@nzmarie.com>';
  const to = [process.env.NOTIFICATION_EMAIL || 'marie@nzmarie.com'];
  const subject = `New Property Appraisal Request: ${params.address}`;
  
  let priority = 'Normal';
  if (params.timeline === 'within-3-months') {
    priority = 'HIGH';
  }

  const html = `
    <h1>New Appraisal Request</h1>
    <p><strong>Priority:</strong> ${priority}</p>
    <p><strong>Name:</strong> ${params.name}</p>
    <p><strong>Address:</strong> ${params.address}</p>
    <p><strong>Email:</strong> ${params.email}</p>
    <p><strong>Phone:</strong> ${params.phone}</p>
    <p><strong>Timeline:</strong> ${params.timeline || 'N/A'}</p>
    <p><strong>Motivation:</strong> ${params.motivation || 'N/A'}</p>
    <p><strong>Language Preference:</strong> ${params.languagePreference || 'N/A'}</p>
    <p><strong>Heard From:</strong> ${params.heardFrom || 'N/A'}</p>
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
