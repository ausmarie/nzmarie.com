'use client';

import { AdminNavbar } from '@/components/admin/Navbar';
import { SessionProvider, useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AppraisalAlertBanner from '@/components/admin/AppraisalAlertBanner';
import AppraisalAlertModal from '@/components/admin/AppraisalAlertModal';
import { useAppraisalAlerts } from '@/lib/hooks/useAppraisalAlerts';

const ALERT_SESSION_KEY = 'appraisalAlertModalShown';

function AdminShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const { items, loading, convertToLead, refresh, hasNew, clearHasNew } = useAppraisalAlerts();
  const [modalOpen, setModalOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const autoShownRef = useRef(false);

  useEffect(() => {
    if (status === 'authenticated') refresh();
  }, [status, refresh]);

  const openModal = useCallback(() => {
    setModalOpen(true);
    clearHasNew();
    try { sessionStorage.setItem(ALERT_SESSION_KEY, '1'); } catch { /* ignore */ }
  }, [clearHasNew]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || loading) return;
    if (items.length === 0) return;

    if (!autoShownRef.current) {
      autoShownRef.current = true;
      let alreadyShown = false;
      try { alreadyShown = sessionStorage.getItem(ALERT_SESSION_KEY) === '1'; } catch { /* ignore */ }
      if (!alreadyShown) openModal();
      return;
    }

    if (hasNew) openModal();
  }, [status, loading, items.length, hasNew, openModal]);

  const handleConvert = async (id: string) => {
    setConvertingId(id);
    try {
      await convertToLead(id);
      if (items.length === 1) setModalOpen(false);
    } catch {
      alert('Failed to convert appraisal to lead. Please try again.');
    } finally {
      setConvertingId(null);
    }
  };

  const showAlert = status === 'authenticated' && !loading && items.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      {showAlert && (
        <div className="pt-24">
          <AppraisalAlertBanner items={items} onReview={openModal} />
        </div>
      )}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 ${showAlert ? 'pt-6' : 'pt-24'}`}>
        {children}
      </main>
      <AppraisalAlertModal
        open={modalOpen}
        items={items}
        convertingId={convertingId}
        onClose={closeModal}
        onConvert={handleConvert}
      />
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
