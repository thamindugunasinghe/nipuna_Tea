'use client';

import { useState } from 'react';
import { LayoutDashboard, Truck, ClipboardList, Settings2 } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import DashboardTab from '@/components/factory/DashboardTab';
import SendTab from '@/components/factory/SendTab';
import CardTab from '@/components/factory/CardTab';
import FactoriesTab from '@/components/factory/FactoriesTab';

type Tab = 'dashboard' | 'send' | 'card' | 'factories';

export default function FactoryDeliveriesPage() {
  const { toast, showToast, hideToast } = useToast();
  const [tab, setTab] = useState<Tab>('dashboard');
  // Lets "waiting for card" lists jump straight to that delivery's card
  const [cardTarget, setCardTarget] = useState<{ date: string; factoryId: number; deliveryId: number } | null>(null);

  const openCard = (d: { deliveryDate: string; factoryId: number; id: number }) => {
    setCardTarget({ date: d.deliveryDate.slice(0, 10), factoryId: d.factoryId, deliveryId: d.id });
    setTab('card');
  };

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard / සාරාංශය' },
    { id: 'send', icon: Truck, label: 'Send to Factory / යැවීම' },
    { id: 'card', icon: ClipboardList, label: 'Factory Card / කාඩ්පත' },
    { id: 'factories', icon: Settings2, label: 'Factories / කර්මාන්තශාලා' },
  ];

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>Factory Deliveries</h1>
      </div>

      <div className="tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab showToast={showToast} onOpenCard={openCard} />}
      {tab === 'send' && <SendTab showToast={showToast} onGoToFactories={() => setTab('factories')} />}
      {tab === 'card' && <CardTab showToast={showToast} target={cardTarget} onOpenCard={openCard} />}
      {tab === 'factories' && <FactoriesTab showToast={showToast} />}
    </div>
  );
}
