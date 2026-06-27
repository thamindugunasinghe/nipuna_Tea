'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Wifi, WifiOff, Leaf, Clock, Truck, RefreshCw, User } from 'lucide-react';

interface OnlineDriver {
  sessionId: number;
  driverId: number;
  driverName: string;
  driverPhone: string | null;
  lorryId: number | null;
  lorryNumber: string | null;
  isActive: boolean;
  startedAt: string;
  stoppedAt: string | null;
  collectionsCount: number;
  totalKilos: number;
}

export default function OnlineDriversPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<{ drivers: OnlineDriver[]; activeCount: number; totalCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/driver-app/online-drivers');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch online drivers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' });
  };

  const getDuration = (startedAt: string, stoppedAt: string | null) => {
    const start = new Date(startedAt).getTime();
    const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return hrs > 0 ? `${hrs}h ${remainMins}m` : `${remainMins}m`;
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  const activeDrivers = data?.drivers.filter(d => d.isActive) || [];
  const stoppedDrivers = data?.drivers.filter(d => !d.isActive) || [];

  return (
    <div>
      <div className="page-header">
        <h1>
          <Wifi size={28} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary-600)' }} />
          Online Drivers / සබැඳි රියදුරන්
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
            Last update: {lastUpdate.toLocaleTimeString()} (auto-refresh 10s)
          </span>
          <button className="btn btn-secondary" onClick={fetchData} style={{ gap: '6px' }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon green"><Wifi size={24} /></div>
          <div className="stat-content">
            <h3>Active Now / දැන් සක්‍රීය</h3>
            <div className="stat-value">{data?.activeCount || 0}</div>
            <div className="stat-sub">drivers online</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><User size={24} /></div>
          <div className="stat-content">
            <h3>Total Today / අද මුළු</h3>
            <div className="stat-value">{data?.totalCount || 0}</div>
            <div className="stat-sub">sessions started</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Leaf size={24} /></div>
          <div className="stat-content">
            <h3>Total Collected / මුළු එකතුව</h3>
            <div className="stat-value">
              {(data?.drivers.reduce((sum, d) => sum + d.totalKilos, 0) || 0).toLocaleString()}
            </div>
            <div className="stat-sub">kg today from all drivers</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><Leaf size={24} /></div>
          <div className="stat-content">
            <h3>Total Collections / මුළු වාර්තා</h3>
            <div className="stat-value">
              {data?.drivers.reduce((sum, d) => sum + d.collectionsCount, 0) || 0}
            </div>
            <div className="stat-sub">collections today</div>
          </div>
        </div>
      </div>

      {/* Active Drivers */}
      {activeDrivers.length > 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#22c55e', boxShadow: '0 0 8px #22c55e',
              animation: 'pulse 2s infinite',
            }} />
            <h2>Active Drivers / සක්‍රීය රියදුරන් ({activeDrivers.length})</h2>
          </div>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Driver / රියදුරු</th>
                  <th>Lorry / ලොරිය</th>
                  <th>Started / ආරම්භ</th>
                  <th>Duration / කාලය</th>
                  <th>Collections / එකතුව</th>
                  <th>Total Kg / මුළු කි.ග්‍රෑ.</th>
                </tr>
              </thead>
              <tbody>
                {activeDrivers.map(d => (
                  <tr key={d.sessionId}>
                    <td>
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                        Online
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{d.driverName}</td>
                    <td>
                      {d.lorryNumber ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Truck size={14} color="var(--gray-500)" />
                          {d.lorryNumber}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{formatTime(d.startedAt)}</td>
                    <td>
                      <span className="badge badge-blue">
                        <Clock size={12} style={{ marginRight: 4 }} />
                        {getDuration(d.startedAt, null)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{d.collectionsCount}</td>
                    <td>
                      <span className="amount amount-positive" style={{ fontWeight: 700 }}>
                        {d.totalKilos.toLocaleString()} kg
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stopped Drivers */}
      {stoppedDrivers.length > 0 && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WifiOff size={18} color="var(--gray-400)" />
            <h2>Finished Today / අද අවසන් ({stoppedDrivers.length})</h2>
          </div>
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Driver / රියදුරු</th>
                  <th>Lorry / ලොරිය</th>
                  <th>Started / ආරම්භ</th>
                  <th>Stopped / නැවතූ</th>
                  <th>Duration / කාලය</th>
                  <th>Collections / එකතුව</th>
                  <th>Total Kg / මුළු කි.ග්‍රෑ.</th>
                </tr>
              </thead>
              <tbody>
                {stoppedDrivers.map(d => (
                  <tr key={d.sessionId} style={{ opacity: 0.7 }}>
                    <td>
                      <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--gray-500)' }}>
                        Offline
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{d.driverName}</td>
                    <td>
                      {d.lorryNumber ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Truck size={14} color="var(--gray-400)" />
                          {d.lorryNumber}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{formatTime(d.startedAt)}</td>
                    <td>{d.stoppedAt ? formatTime(d.stoppedAt) : '-'}</td>
                    <td>{getDuration(d.startedAt, d.stoppedAt)}</td>
                    <td>{d.collectionsCount}</td>
                    <td>{d.totalKilos.toLocaleString()} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No data state */}
      {data && data.totalCount === 0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '60px' }}>
            <WifiOff size={48} color="var(--gray-300)" />
            <h3 style={{ color: 'var(--gray-500)', marginTop: '12px' }}>No Drivers Online Today</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>
              No drivers have started their operation today. / අද කිසිදු රියදුරෙක් මෙහෙයුම ආරම්භ කර නැත.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
