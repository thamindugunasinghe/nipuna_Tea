'use client';

import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';
import {
  LayoutDashboard,
  Users,
  Leaf,
  ShoppingCart,
  Truck,
  DollarSign,
  Award,
  Settings,
  LogOut,
  UserCog,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { href: '/customers', icon: Users, labelKey: 'nav.customers' },
  { href: '/collections', icon: Leaf, labelKey: 'nav.collections' },
  { href: '/purchases', icon: ShoppingCart, labelKey: 'nav.purchases' },
  { href: '/fleet', icon: Truck, labelKey: 'nav.fleet' },
  { href: '/payments', icon: DollarSign, labelKey: 'nav.payments' },
  { href: '/commissions', icon: Award, labelKey: 'nav.commissions' },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { href: '/users', icon: UserCog, labelKey: 'nav.users' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-header">
          <Image
            src="/logo.jpg"
            alt="Nipuna Tea"
            width={48}
            height={48}
            className="sidebar-logo"
            priority
          />
          <div className="sidebar-brand">
            <h1>{t('common.appName')}</h1>
            <p>Management System</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-btn"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut size={18} />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
