import Link from 'next/link';

type PropertyWorkspaceView = 'properties' | 'realestate';

interface PropertyWorkspaceTabsProps {
  activeView?: PropertyWorkspaceView;
}

const views: Array<{ id: PropertyWorkspaceView; label: string; href: string }> = [
  { id: 'properties', label: 'Properties', href: '/admin/properties' },
  { id: 'realestate', label: 'Realestate', href: '/admin/realestate' },
];

export function PropertyWorkspaceTabs({
  activeView = 'properties',
}: PropertyWorkspaceTabsProps) {
  return (
    <nav aria-label="Property views" className="mb-6">
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {views.map((view) => {
          const isActive = activeView === view.id;

          return (
            <Link
              key={view.id}
              href={view.href}
              prefetch={false}
              aria-current={isActive ? 'page' : undefined}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
