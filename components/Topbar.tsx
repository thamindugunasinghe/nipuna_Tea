'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { Menu } from 'lucide-react';

const pageTitleMap: Record<string, string> = {
  '/dashboard': 'dashboard.title',
  '/customers': 'customers.title',
  '/collections': 'collections.title',
  '/purchases': 'purchases.title',
  '/fleet': 'fleet.title',
  '/payments': 'payments.title',
  '/commissions': 'commissions.title',
  '/settings': 'settings.title',
  '/users': 'users.title',
};

export default function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();

  const titleKey = Object.entries(pageTitleMap).find(([path]) =>
    pathname === path || pathname?.startsWith(path + '/')
  )?.[1] || 'dashboard.title';

  const toggleSidebar = () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('visible');
  };

  const userName = session?.user?.name || 'User';
  const userRole = (session?.user as any)?.role || 'staff';
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <button className="menu-toggle" onClick={toggleSidebar}>
            <Menu size={24} />
          </button>
          <h2 className="topbar-title">{t(titleKey)}</h2>
        </div>

        <div className="topbar-right">
          <div className="lang-switcher">
            <button
              className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
            >
              EN
            </button>
            <button
              className={`lang-btn ${locale === 'si' ? 'active' : ''}`}
              onClick={() => setLocale('si')}
            >
              සිං
            </button>
          </div>

          <div className="user-menu">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">{userRole}</span>
            </div>
          </div>
        </div>
      </div>

      <div id="sidebar-overlay" className="sidebar-overlay" onClick={toggleSidebar} />
    </>
  );
}
