export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="blog-layout-wrapper"
      style={{
        position: 'fixed',
        top: '64px',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
