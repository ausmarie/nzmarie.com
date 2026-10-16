'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { isSuperAdmin } from '@/lib/permissions';

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminNavbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const [hidden, setHidden] = useState(false);

  const handleScroll = useCallback((e: Event) => {
    const target = e.target;
    if (!ticking.current) {
      ticking.current = true;
      requestAnimationFrame(() => {
        // Reports page scrolls in an inner container (reports layout <main>), not the window.
        // Capture-phase listener lets us detect its scrollTop; fall back to window.scrollY otherwise.
        const y = target instanceof HTMLElement ? target.scrollTop : window.scrollY;
        const delta = y - lastScrollY.current;
        lastScrollY.current = y;
        if (delta > 10 && y > 60) {
          setHidden(true);
        } else if (delta < -10 || y <= 60) {
          setHidden(false);
        }
        ticking.current = false;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
  }, [handleScroll]);

  const superAdmin = session?.user?.email ? isSuperAdmin(session.user.email) : false;
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  const navLinks = [
    { href: '/admin/activity', label: 'Activity', alwaysShow: true },
    { href: '/admin/properties', label: 'Properties', alwaysShow: true },
    { href: '/admin/outreach', label: 'Outreach', alwaysShow: true },
    { href: '/admin/leads', label: 'Leads', alwaysShow: true },
    { href: '/admin/realestate', label: 'Realestate', alwaysShow: true },
    { href: '/admin/analytics', label: 'Analytics', alwaysShow: false },
    { href: '/admin/reports', label: 'Reports', alwaysShow: false },
    { href: '/admin/assets', label: 'Assets', alwaysShow: false },
  ];

  function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const isActive = isPathActive(pathname, href);

    return (
      <Link
        href={href}
        className={`${
          isActive
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-700 hover:text-gray-900'
        } px-2 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap`}
      >
        {children}
      </Link>
    );
  }

  return (
    <>
    <nav className={`bg-white shadow-sm fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center gap-2 py-3">
          {/* Left: Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link
              href="/admin"
              className="text-lg font-semibold text-gray-900 hover:text-gray-700"
            >
              CRM
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:flex flex-1 items-center justify-center flex-wrap gap-x-0.5">
            {navLinks.map(link => {
              if (!link.alwaysShow && !superAdmin) return null;

              return (
                <NavLink key={link.href} href={link.href}>
                  {link.label}
                </NavLink>
              );
            })}
          </div>

          {/* Right: User Menu */}
          <div className="flex-shrink-0 flex items-center justify-end space-x-3">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* User Dropdown Menu */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors" aria-label="User menu">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {userInitial}
                  </span>
                </div>
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/admin/settings"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block px-4 py-2 text-sm text-gray-700`}
                        >
                          Settings
                        </Link>
                      )}
                    </Menu.Item>
                    <div className="border-t border-gray-100" />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                        >
                          Sign Out
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </nav>

      {/* Mobile Menu Sidebar — rendered outside <nav> to avoid stacking context clipping */}
      <Transition
        show={mobileMenuOpen}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <span className="text-lg font-semibold">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 overflow-y-auto py-4">
                {navLinks.map(link => {
                  if (!link.alwaysShow && !superAdmin) return null;

                  const isActive = isPathActive(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`${
                        isActive
                          ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      } block px-4 py-3 text-sm font-medium`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </>
  );
}
