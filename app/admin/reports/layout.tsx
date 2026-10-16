'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useReportStore } from './stores/report-store';
import ReportSidebar from './components/ReportSidebar';

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function quarterToSlug(quarter: string): string {
  const parts = quarter.split('-Q');
  if (parts.length === 2) {
    return `q${parts[1].toLowerCase()}-${parts[0]}`;
  }
  return quarter.toLowerCase();
}

function addToSlugMaps(
  slugMap: Record<string, string>,
  idToSlug: Record<string, string>,
  id: string,
  baseSlug: string,
) {
  let slug = baseSlug;
  let counter = 2;
  while (slugMap[slug] && slugMap[slug] !== id) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  slugMap[slug] = id;
  if (!idToSlug[id]) {
    idToSlug[id] = slug;
  }
}

const ABOUT_MARIE_CONTENT = [
  { type: 'image', props: { url: '/img/Marie_large7-Photoroom.png', caption: '', showPreview: true, previewWidth: 220 }, content: [] },
  { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'About Marie Nian', styles: {} }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Marie Nian is a dedicated real estate professional serving the North Shore community. With extensive local market knowledge, Marie provides personalised service to buyers and sellers across the North Shore.', styles: {} }] },
  { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Services Offered', styles: {} }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Free property appraisals and market analysis', styles: {} }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Expert negotiation and sales strategy', styles: {} }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Comprehensive marketing campaigns', styles: {} }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Buyer representation and property search', styles: {} }] },
  { type: 'bulletListItem', content: [{ type: 'text', text: 'Investment portfolio advice', styles: {} }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Contact Marie today for a no-obligation discussion about your property goals.', styles: {} }] },
  { type: 'paragraph', props: { textAlignment: 'center' }, content: [{ type: 'text', text: 'www.nzmarie.co.nz', styles: {} }] },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const { setDocuments, setSuburbs, slugMap, idToSlug, setSlugMap, sidebarCollapsed, setSidebarCollapsed, refreshKey, setOverviewSuburbs } = useReportStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docRes, subRes, overviewRes] = await Promise.all([
          fetch('/api/admin/reports/documents'),
          fetch('/api/admin/reports/suburbs'),
          fetch('/api/admin/reports/overview'),
        ]);
        const docData = await docRes.json();
        const subData = await subRes.json();
        const overviewData = await overviewRes.json();
        if (docData.success) setDocuments(docData.documents);
        if (subData.success) setSuburbs(subData.suburbs);

        if (overviewData.success) {
          setOverviewSuburbs(overviewData.suburbs);
          const slugMap: Record<string, string> = {};
          const idToSlug: Record<string, string> = {};

          for (const suburb of overviewData.suburbs) {
            const slugName = toSlug(suburb.name);

            // Intro doc
            if (suburb.introDoc) {
              addToSlugMaps(slugMap, idToSlug, suburb.introDoc.id, `${slugName}-introduction`);
            }
            // Letter doc
            if (suburb.letterDoc) {
              addToSlugMaps(slugMap, idToSlug, suburb.letterDoc.id, `${slugName}-letter`);
            }
            // Quarter reports
            for (const report of suburb.reports) {
              const qSlug = quarterToSlug(report.quarter);
              addToSlugMaps(slugMap, idToSlug, report.id, `${slugName}-${qSlug}`);
            }
            // Fallback: suburb name → first available doc
            const firstDoc = suburb.introDoc || suburb.letterDoc || suburb.reports?.[0];
            if (firstDoc && !slugMap[slugName]) {
              slugMap[slugName] = firstDoc.id;
            }
          }

          // Fetch/create about_marie doc for slug map
          try {
            let amDocId: string | null = null;
            const amRes = await fetch('/api/admin/reports/documents?type=general');
            const amData = await amRes.json();
            if (amData.success) {
              const byIcon = amData.documents.find((d: { icon: string }) => d.icon === 'about_marie');
              const byTitle = amData.documents.find((d: { title: string; icon: string | null }) => d.title === 'About Marie' && d.icon !== 'about_marie');
              if (byIcon) {
                amDocId = byIcon.id;
              } else if (byTitle) {
                amDocId = byTitle.id;
                await fetch('/api/admin/reports/documents', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: byTitle.id, icon: 'about_marie' }),
                });
              } else {
                const createRes = await fetch('/api/admin/reports/documents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ doc_type: 'general', title: 'About Marie', icon: 'about_marie', content: ABOUT_MARIE_CONTENT }),
                });
                const createData = await createRes.json();
                if (createData.success) amDocId = createData.id;
              }
            }
            if (amDocId) {
              addToSlugMaps(slugMap, idToSlug, amDocId, 'about-marie');
            }
          } catch {}
          setSlugMap(slugMap, idToSlug);
        }
      } catch {
        // silent
      }
    };
    fetchData();
  }, [setDocuments, setSuburbs, setSlugMap, setOverviewSuburbs, refreshKey]);

  // Canonicalize UUID URLs → human-readable slugs (only when slugMap has the mapping)
  useEffect(() => {
    const match = pathname.match(/^\/admin\/reports\/(.+)$/);
    if (match) {
      const slug = match[1];
      if (/^[a-f0-9-]{36}$/.test(slug) && idToSlug[slug]) {
        const targetSlug = idToSlug[slug];
        if (slugMap[targetSlug] === slug) {
          router.replace(`/admin/reports/${targetSlug}`, { scroll: false });
        }
      }
    }
  }, [pathname, idToSlug, slugMap, router]);

  return (
    <>
      <style>{`
        .print-page-header, .print-page-footer { display: none; }
        .about-marie-editor [data-block-type="image"]:first-child {
          float: left;
          margin: 0 24px 16px 0;
          max-width: 220px;
        }
        .about-marie-editor [data-block-type="image"]:first-child .bn-block-content {
          width: auto !important;
        }
        .about-marie-editor [data-block-type="image"]:first-child + [data-block-type="heading"] {
          padding-top: 0;
        }

        /* Premium Suburb Title Section (H1) Flex Container */
        .is-quarterly-report h1 {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 16px !important; /* flex items-center gap-4 */
          text-decoration: none !important;
          border-bottom: none !important;
        }

        @media print {
          /* Hide navigation bar */
          nav { display: none !important; }
          /* Hide default report footer */
          .print-footer { display: none !important; }
          
          .reports-sidebar { display: none !important; }
          .reports-toolbar { display: none !important; }
          .reports-editor-status { display: none !important; }
          .edit-header-footer-btn { display: none !important; }
          body {
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Reset AdminLayout wrappers */
          .min-h-screen,
          main,
          .max-w-7xl {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            min-height: 0 !important;
            background: transparent !important;
          }
          
          .reports-layout-wrapper {
            position: static !important;
            overflow: visible !important;
            display: block !important;
          }
          .reports-layout-wrapper > main {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .reports-layout-wrapper > main > div {
            background: white !important;
          }

          @page {
            margin: 0;
            size: A4 portrait;
          }

          .report-editor-container {
            max-width: 100% !important;
            width: 100% !important;
            padding: 83px 54px 83px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }

          .bn-editor {
            padding: 0 !important;
          }
          .is-quarterly-report .bn-container .bn-editor {
            font-size: 13px !important;
            line-height: 1.45 !important;
          }
          .is-quarterly-report .bn-container [data-content-type="heading"][data-level="1"] {
            font-size: 1.5rem !important;
          }
          .is-quarterly-report .bn-container [data-content-type="heading"][data-level="2"] {
            font-size: 1.25rem !important;
          }
          .is-quarterly-report .bn-container [data-content-type="heading"][data-level="3"] {
            font-size: 1.1rem !important;
          }

          [data-block-type="divider"] + [data-block-type="heading"] {
            page-break-before: always;
          }
          [data-block-type="divider"] {
            display: none !important;
          }

          /* ===== Print Header & Footer ===== */
          .print-page-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 64px !important;
            padding: 0 54px !important;
            z-index: 9999 !important;
            background: white !important;
            border-bottom: 1px solid rgba(226, 232, 240, 0.7) !important;
            box-sizing: border-box !important;
            font-size: 0.75rem !important;
            color: #94a3b8 !important;
            font-weight: 500 !important;
          }
          .print-page-footer {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 64px !important;
            padding: 0 54px !important;
            z-index: 9999 !important;
            background: white !important;
            border-top: 1px solid rgba(226, 232, 240, 0.7) !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            font-size: 11px !important;
            color: #94a3b8 !important;
          }
          .print-page-footer-text {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            padding-right: 24px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            font-size: 11px !important;
            color: #94a3b8 !important;
            font-weight: 300 !important;
          }
          .print-page-footer-page {
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            font-size: 11px !important;
            color: #94a3b8 !important;
            font-weight: 300 !important;
            letter-spacing: 0.025em !important;
          }
          .page-count::before {
            content: counter(page) !important;
          }
        }
      `}</style>
      <div className="reports-layout-wrapper" style={{
        position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0,
        display: 'flex', overflow: 'hidden',
      }}>
        {sidebarCollapsed ? (
          <div
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
            style={{
              width: 20, minWidth: 20, height: '100%', cursor: 'pointer',
              background: '#f7f6f3', borderRight: '1px solid #e8e7e4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', fontSize: '0.75rem', transition: 'color 0.1s, background 0.1s',
              flexShrink: 0, userSelect: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#333'; e.currentTarget.style.background = '#e8e7e4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = '#f7f6f3'; }}
          >
            ▶
          </div>
        ) : (
          <ReportSidebar />
        )}
        <main style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
          {children}
        </main>
      </div>
    </>
  );
}
