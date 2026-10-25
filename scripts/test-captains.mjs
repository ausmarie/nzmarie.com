import { fetchOutreachData } from '../app/api/admin/outreach/route.js';

async function run() {
  const sp = new URLSearchParams({
    status: 'pending',
    page: '1',
    limit: '9',
    sortOrder: 'asc',
    suburb: 'Torbay',
    street: 'Captains Close',
    sent_status: 'unsent',
    report_quarter: '2026-Q3',
  });
  const data = await fetchOutreachData(sp);
  console.log('Result count:', data.data?.length);
  console.log('Data:', data.data);
  console.log('Pagination:', data.pagination);
}
run().catch(console.error);
