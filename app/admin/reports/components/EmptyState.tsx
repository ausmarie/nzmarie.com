'use client';

export default function EmptyState({ onCreatePage }: { onCreatePage: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#bbb', padding: 40,
    }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>📄</div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 600, color: '#999' }}>
        No document selected
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#ccc' }}>
        Create a new document or select one from the sidebar.
      </p>
      <button onClick={onCreatePage} style={{
        padding: '10px 24px', borderRadius: 8, border: 'none',
        background: '#1a73e8', color: 'white', fontWeight: 500,
        cursor: 'pointer', fontSize: '0.9rem',
      }}>
        + New page
      </button>
    </div>
  );
}
