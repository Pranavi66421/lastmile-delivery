import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Truck, Shield, RefreshCw, CloudRain } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import MapComponent from './components/MapComponent';
import ChatPanel from './components/ChatPanel';
import AdminPanel from './components/AdminPanel';
import CustomerPortal from './components/CustomerPortal';
import AgentPortal from './components/AgentPortal';
import NotificationsBar from './components/NotificationsBar';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = sessionStorage.getItem('lastmile_token');
    const stored = sessionStorage.getItem('lastmile_user');
    if (token && stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    sessionStorage.removeItem('lastmile_user');
    return null;
  });

  const [activeTab, setActiveTab] = useState('customer');

  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [zones, setZones] = useState([]);
  const [rates, setRates] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [weather, setWeather] = useState('Sunny');
  const [traffic, setTraffic] = useState('Light');

  const [activeSelection, setActiveSelection] = useState([40.730610, -73.935242]);
  const [mapClickCoords, setMapClickCoords] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const getAuthHeaders = () => {
    const token = sessionStorage.getItem('lastmile_token');
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
  };

  const navigate = useNavigate();

  const handleSignOut = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('lastmile_token');
    sessionStorage.removeItem('lastmile_user');
    navigate('/');
  };

  const loadAllData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const agentPromise = fetch('/api/agents', { headers: authHeaders }).then(r => r.json());
      const zonePromise = fetch('/api/zones', { headers: authHeaders }).then(r => r.json());

      const [resAgents, resZones] = await Promise.all([agentPromise, zonePromise]);
      if (Array.isArray(resAgents)) setAgents(resAgents);
      if (Array.isArray(resZones)) setZones(resZones);

      const resOrders = await fetch('/api/orders', { headers: authHeaders }).then(r => r.json());
      if (Array.isArray(resOrders)) setOrders(resOrders);

      if (currentUser?.role === 'admin') {
        const resRates = await fetch('/api/rates', { headers: authHeaders }).then(r => r.json());
        if (Array.isArray(resRates)) setRates(resRates);
      }
      
      if (currentUser?.role === 'admin' || currentUser?.role === 'customer') {
        const resNotifs = await fetch('/api/notifications', { headers: authHeaders }).then(r => r.json());
        if (Array.isArray(resNotifs)) setNotifications(resNotifs);
      }
    } catch (err) {
      console.error('loadAllData error:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAllData();
      setOptimizedRoute(null);
      setMapClickCoords(null);
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
      const timer = setInterval(() => loadAllData(), 2000);
      return () => clearInterval(timer);
    }
  }, [currentUser]);

  const handleResetSimulation = async () => {
    if (window.confirm('Wipe and reset the database? This will delete ALL data.')) {
      const res = await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: getAuthHeaders()
      }).then(r => r.json());
      if (res.success) {
        alert('Database reset. You will be signed out.');
        handleSignOut();
      } else {
        alert(res.error || 'Reset failed.');
      }
    }
  };

  const handleAddZone = async (zoneData) => {
    const res = await fetch('/api/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(zoneData)
    }).then(r => r.json());
    if (res.error) alert(res.error);
    else { loadAllData(); setActiveSelection([zoneData.center_lat, zoneData.center_lng]); }
  };

  const handleDeleteZone = async (id) => {
    await fetch(`/api/zones/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    loadAllData();
  };

  const handleUpdateRates = async (id, data) => {
    await fetch(`/api/rates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    loadAllData();
  };

  const handleAutoAssign = async (orderId) => {
    const res = await fetch(`/api/orders/${orderId}/auto-assign`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json());
    if (res.error) alert(res.error);
    else { loadAllData(); setActiveSelection([res.pickup_lat, res.pickup_lng]); }
  };

  const handleManualAssign = async (orderId, agentId) => {
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ agent_id: agentId })
    }).then(r => r.json());
    if (res.error) alert(res.error);
    else { loadAllData(); setActiveSelection([res.pickup_lat, res.pickup_lng]); }
  };

  const handleTriggerVRPOptimize = async (agentId, orderIds) => {
    const res = await fetch('/api/routing/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ agent_id: agentId, order_ids: orderIds })
    }).then(r => r.json());
    if (res.error) alert(res.error);
    else { setOptimizedRoute(res); alert(`Optimized route generated! Dist: ${res.totalDistanceKM}km`); }
  };

  const handleCalculateRates = async (orderDetails) => {
    return fetch('/api/orders/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderDetails) }).then(res => res.json());
  };

  const handlePlaceOrder = async (orderData) => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(orderData)
    }).then(r => r.json());
    if (res.error) { alert(res.error); return null; }
    loadAllData();
    setActiveSelection([orderData.pickup_lat, orderData.pickup_lng]);
    return res;
  };

  const handleRescheduleOrder = async (orderId, date) => {
    const res = await fetch(`/api/orders/${orderId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reschedule_date: date })
    }).then(r => r.json());
    if (res.error) alert(res.error);
    else { loadAllData(); setActiveSelection([res.pickup_lat, res.pickup_lng]); }
  };

  const handleUpdateStatus = async (orderId, status, remarks) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ status, remarks })
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    loadAllData();
    return res;
  };

  const handleSimulateGPS = async (agentId, lat, lng) => {
    const res = await fetch('/api/simulation/agent-gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ agent_id: agentId, lat, lng })
    }).then(r => r.json());
    loadAllData();
    setActiveSelection([lat, lng]);
    return res;
  };

  const handleMapClick = (lat, lng) => {
    setMapClickCoords({ lat, lng });
  };

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-container">

      <header className="header">
        <div className="header-title">
          <Truck size={24} color="#6366f1" />
          <h1>Last-Mile Delivery Optimizer</h1>
          <span className="badge-pill">Enterprise v2.0</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentUser && (
            <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Signed in as</span>
              <strong>👤 {currentUser.username}</strong>
              <span style={{ fontSize: '0.65rem', background: currentUser.role === 'admin' ? 'rgba(239,68,68,0.15)' : currentUser.role === 'agent' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)', color: currentUser.role === 'admin' ? '#f87171' : currentUser.role === 'agent' ? '#fbbf24' : '#a5b4fc', padding: '0.1rem 0.5rem', borderRadius: '999px', border: '1px solid currentColor', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{currentUser.role}</span>
              <button className="hud-btn" onClick={handleSignOut} style={{ marginLeft: '0.25rem', background: '#ef4444', borderColor: 'transparent', color: '#fff' }}>Sign Out</button>
            </div>
          )}

          {currentUser?.role === 'admin' && (
            <button className="btn btn-secondary" onClick={handleResetSimulation} style={{ padding: '0.45rem 0.75rem', fontSize: '0.75rem', width: 'auto' }}>
              <RefreshCw size={12}/> Reset DB
            </button>
          )}
        </div>
      </header>

      {currentUser && currentUser.role === 'agent' ? (
        <main className="agent-dashboard-layout">
          <div className="agent-background-map">
            <MapComponent 
              zones={zones} orders={orders} agents={agents}
              activeSelection={activeSelection} onMapClick={() => {}} optimizedRoute={null}
              selectedOrderId={selectedOrderId}
            />
          </div>
          <div className="agent-phone-container">
            <AgentPortal 
              agents={agents} orders={orders} onUpdateStatus={handleUpdateStatus} onSimulateGPS={handleSimulateGPS} 
              currentUser={currentUser} getAuthHeaders={getAuthHeaders}
            />
          </div>
        </main>
      ) : currentUser && currentUser.role === 'customer' ? (
        <main className="customer-dashboard-layout">
          <section className="sidebar-left" style={{ padding: '1.25rem' }}>
            <CustomerPortal 
              orders={orders} mapClickCoords={mapClickCoords} clearMapClickCoords={() => setMapClickCoords(null)}
              onCalculateRates={handleCalculateRates} onPlaceOrder={handlePlaceOrder} onRescheduleOrder={handleRescheduleOrder}
              weather={weather} traffic={traffic} currentUser={currentUser} getAuthHeaders={getAuthHeaders}
            />
          </section>

          <section className="center-area">
            <div className="map-container" style={{ height: '100%' }}>
              <MapComponent 
                zones={zones} orders={orders} agents={agents}
                activeSelection={activeSelection} onMapClick={handleMapClick} optimizedRoute={optimizedRoute}
                selectedOrderId={selectedOrderId}
              />
            </div>
          </section>

          <section className="sidebar-right notifications-drawer">
            <NotificationsBar notifications={notifications} onRefresh={loadAllData} />
          </section>
        </main>
      ) : (
        <main className="dashboard-grid admin-dashboard-layout">
          <section className="sidebar-left" style={{ padding: '1.25rem' }}>
            <AdminPanel 
              zones={zones} orders={orders} agents={agents} rates={rates}
              onAddZone={handleAddZone} onDeleteZone={handleDeleteZone} onUpdateRates={handleUpdateRates}
              onAutoAssign={handleAutoAssign} onManualAssign={handleManualAssign} onTriggerVRPOptimize={handleTriggerVRPOptimize}
              mapClickCoords={mapClickCoords} clearMapClickCoords={() => setMapClickCoords(null)}
              onCalculateRates={handleCalculateRates} onPlaceOrder={handlePlaceOrder} weather={weather} traffic={traffic}
              getAuthHeaders={getAuthHeaders}
            />
          </section>

          <section className="center-area">
            <div className="map-container" style={{ height: '65%' }}>
              <MapComponent 
                zones={zones} orders={orders} agents={agents}
                activeSelection={activeSelection} onMapClick={handleMapClick} optimizedRoute={optimizedRoute}
                selectedOrderId={selectedOrderId}
              />
            </div>
            <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={16} color="#6366f1"/> Active System Console
                </h3>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', fontSize: '0.75rem' }}>
                  <div>Total Orders: <strong>{orders.length}</strong></div>
                  <div>Zones: <strong>{zones.length}</strong></div>
                  <div>Active Riders: <strong>{agents.filter(a => a.status === 'active').length}</strong></div>
                  <div>Completed: <strong>{orders.filter(o => o.status === 'Delivered').length}</strong></div>
                </div>
              </div>
            </div>
          </section>

          <section className="sidebar-right notifications-drawer">
            <NotificationsBar notifications={notifications} onRefresh={loadAllData} />
          </section>
        </main>
      )}

      <footer className="control-bar">
        <div className="control-bar-item">
          <CloudRain size={16} color="#38bdf8"/>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Simulated Weather:</span>
          <select className="control-select" value={weather} onChange={e => setWeather(e.target.value)}>
            <option value="Sunny">Sunny (Standard Fees)</option>
            <option value="Rainy">Rainy (+10% Premium Surcharge)</option>
            <option value="Stormy">Stormy (+20% Premium Surcharge)</option>
          </select>
        </div>
        <div className="control-bar-item">
          <Truck size={16} color="#f472b6"/>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Simulated Traffic:</span>
          <select className="control-select" value={traffic} onChange={e => setTraffic(e.target.value)}>
            <option value="Light">Light Traffic (Standard ETAs)</option>
            <option value="Moderate">Moderate Traffic (+8% Surcharge)</option>
            <option value="Gridlock">Gridlock Traffic (+15% Surcharge)</option>
          </select>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          *Surcharges dynamically apply to rate estimations.
        </div>
      </footer>
    </div>
  );
}
