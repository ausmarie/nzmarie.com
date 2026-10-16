'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNotFound() {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center px-4">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100 text-blue-600 mb-4">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
          <p className="text-xl text-gray-600 mb-2">Page Not Found</p>
          <p className="text-sm text-gray-500">
            The page <span className="font-mono text-blue-600">{pathname}</span> could not be found.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/admin/dashboard"
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/admin/bookings"
            className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200"
          >
            View Bookings
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">Need help?</strong> Make sure you&apos;re accessing a valid admin page.
          </p>
          <div className="mt-3 text-xs text-gray-500 text-left">
            <p className="font-medium text-gray-700 mb-1">Available pages:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>/admin/dashboard</li>
              <li>/admin/bookings</li>
              <li>/admin/properties</li>
              <li>/admin/outreach</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
