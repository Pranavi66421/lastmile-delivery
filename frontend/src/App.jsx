import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { 
  Truck, Shield, Navigation, Trophy, Star, Plus, Trash2, 
  MapPin, Calendar, Clock, AlertTriangle, ShoppingBag, 
  Calculator, MessageSquare, Mail, RefreshCw, Compass, CheckCircle2, ShieldAlert, AlertCircle, CloudRain
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';

// ==========================================
// 1. LEAFLET INTERACTIVE MAP COMPONENT
// ==========================================

const createIcon = (color) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32" stroke="#fff" stroke-width="1.5">
    <circle cx="12" cy="12" r="10" fill-opacity="0.2"/>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const createAgentIcon = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#6366f1" width="38" height="38" stroke="#fff" stroke-width="1.5">
    <path d="M19 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-14 0c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm11.5-6h-3.41L11.8 5.4c-.37-.38-.99-.38-1.37 0L8.71 7.1H5V9h2.89l1.8 1.8H5c-1.1 0-2 .9-2 2v1c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-1c0-1.1-.9-2-2-2h-2.5l-3-3z"/>
  </svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
};

function MapClickEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function AuthOverlay({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister 
      ? { username, password, email, phone }
      : { username, password };
      
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data);
      } else {
        setErrorMsg(data.error || 'Authentication failed');
      }
    } catch (err) {
      setErrorMsg('Server connection failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card glass-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Truck size={32} color="#6366f1" />
          </div>
          <h2 className="auth-title">Think Last-Mile</h2>
          <p className="auth-subtitle">Logistics Routing &amp; Dispatch Platform</p>
        </div>
        {errorMsg && (
          <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', marginBottom: '1rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-input" placeholder="+15550000" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '0.4rem 0', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                🔒 Self-registration creates a <strong>Customer</strong> account only.
                Agents and Admins are provisioned by system administrators.
              </div>
            </>
          )}
          <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>
        <div className="auth-toggle">
          {isRegister ? (
            <span>Already have an account? <span className="auth-toggle-link" onClick={() => { setIsRegister(false); setErrorMsg(''); }}>Sign In</span></span>
          ) : (
            <span>New customer? <span className="auth-toggle-link" onClick={() => { setIsRegister(true); setErrorMsg(''); }}>Register here</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ orderId, currentUser, getAuthHeaders }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const loadMessages = async () => {
    try {
      const token = localStorage.getItem('lastmile_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/orders/${orderId}/messages`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 1500);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    try {
      await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ message: inputText })
      });
      setInputText('');
      loadMessages();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="chat-container">
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <MessageSquare size={14} color="#6366f1"/> Live Courier Chat
      </div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', margin: 'auto' }}>No messages yet. Send a message to start!</div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUser?.id;
            return (
              <div key={msg.id} className={`chat-bubble ${isMe ? 'sent' : 'received'}`}>
                <div style={{ fontWeight: 700, fontSize: '0.65rem', color: isMe ? '#e0e7ff' : '#a5b4fc', marginBottom: '0.15rem' }}>{msg.sender_name}</div>
                <div>{msg.message}</div>
                <div className="chat-bubble-meta">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="chat-input-row" style={{ margin: 0 }}>
        <input type="text" className="chat-input" placeholder="Type message..." value={inputText} onChange={e => setInputText(e.target.value)} />
        <button type="submit" className="btn btn-accent" style={{ width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Send</button>
      </form>
    </div>
  );
}


function MapComponent({ zones, orders, agents, activeSelection, onMapClick, optimizedRoute, selectedOrderId }) {
  const defaultCenter = [40.730610, -73.935242];

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'Created': return '#3b82f6';
      case 'Assigned': return '#8b5cf6';
      case 'Picked Up': return '#f59e0b';
      case 'In Transit': return '#06b6d4';
      case 'Out for Delivery': return '#ec4899';
      case 'Delivered': return '#10b981';
      case 'Failed': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }} doubleClickZoom={false}>
        <TileLayer
          attribution='&copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ChangeView center={activeSelection} />
        {onMapClick && <MapClickEvents onMapClick={onMapClick} />}

        {zones.map(zone => (
          <Circle 
            key={zone.id}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_km * 1000}
            pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1, weight: 1.5, dashArray: '4, 4' }}
          >
            <Popup><strong>Zone: {zone.name}</strong><br/>Radius: {zone.radius_km} km</Popup>
          </Circle>
        ))}

        {orders.map(order => {
          const color = getOrderStatusColor(order.status);
          const showRoute = order.status !== 'Delivered' && order.status !== 'Failed';
          const isSelected = selectedOrderId === order.id;

          return (
            <React.Fragment key={order.id}>
              {isSelected && (
                <Circle 
                  center={[order.drop_lat, order.drop_lng]}
                  radius={150}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1.5, dashArray: '3, 3' }}
                />
              )}
              <Marker position={[order.pickup_lat, order.pickup_lng]} icon={createIcon('#10b981')}>
                <Popup>
                  <strong>Pickup (Order #{order.id})</strong><br/>
                  Address: {order.pickup_address}<br/>
                  SLA: {order.order_type} | Weight: {order.billing_weight}kg
                </Popup>
              </Marker>
              <Marker position={[order.drop_lat, order.drop_lng]} icon={createIcon('#ef4444')}>
                <Popup>
                  <strong>Drop-off (Order #{order.id})</strong><br/>
                  Address: {order.drop_address}<br/>
                  Status: <span style={{ color }}>{order.status}</span>
                </Popup>
              </Marker>
              {showRoute && (
                <Polyline 
                  positions={[[order.pickup_lat, order.pickup_lng], [order.drop_lat, order.drop_lng]]}
                  pathOptions={{ color: color, weight: 2, dashArray: '5, 8', opacity: 0.6 }}
                />
              )}
            </React.Fragment>
          );
        })}

        {agents.map(agent => (
          agent.current_lat && agent.current_lng ? (
            <Marker key={agent.id} position={[agent.current_lat, agent.current_lng]} icon={createAgentIcon()}>
              <Popup>
                <strong>Rider: {agent.username}</strong><br/>
                Status: {agent.status}<br/>
                Score: 🏆 {agent.points} XP | Rating: ⭐ {agent.rating.toFixed(1)}
              </Popup>
            </Marker>
          ) : null
        ))}

        {optimizedRoute && optimizedRoute.path && (
          <Polyline 
            positions={optimizedRoute.path.map(p => [p.lat, p.lng])}
            pathOptions={{ color: '#38bdf8', weight: 4, opacity: 0.9 }}
          />
        )}
      </MapContainer>
      <div style={{
        position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000,
        background: 'rgba(17, 24, 39, 0.9)', padding: '6px 12px', borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem', color: '#94a3b8', pointerEvents: 'none'
      }}>
        🟢 Greens: Pickups | 🔴 Reds: Drops | 🏍️ Riders | 🔵 Dotted: Active Deliveries
      </div>
    </div>
  );
}

// ==========================================
// 2. ADMIN PANEL COMPONENT
// ==========================================

function AdminPanel({ zones, orders, agents, rates, onAddZone, onDeleteZone, onUpdateRates, onAutoAssign, onManualAssign, onTriggerVRPOptimize, mapClickCoords, clearMapClickCoords, onCalculateRates, onPlaceOrder, weather, traffic, getAuthHeaders }) {
  const [activeSubTab, setActiveSubTab] = useState('orders');
  const [zoneName, setZoneName] = useState('');
  const [zoneRadius, setZoneRadius] = useState(3.0);
  const [selectedAgentForVRP, setSelectedAgentForVRP] = useState('');
  const [selectedOrderIdsForVRP, setSelectedOrderIdsForVRP] = useState([]);

  // Admin Custom Booking States
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [pickupAddr, setPickupAddr] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [dropAddr, setDropAddr] = useState('');
  const [dropLat, setDropLat] = useState('');
  const [dropLng, setDropLng] = useState('');
  const [length, setLength] = useState(30);
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  const [actualWeight, setActualWeight] = useState(1.5);
  const [orderType, setOrderType] = useState('B2C');
  const [paymentType, setPaymentType] = useState('Prepaid');
  const [selectingCoordFor, setSelectingCoordFor] = useState(null);
  const [pricingBreakdown, setPricingBreakdown] = useState(null);

  // Load active customers (admin-only endpoint)
  useEffect(() => {
    const token = localStorage.getItem('lastmile_token');
    fetch('/api/customers', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCustomers(data); })
      .catch(console.error);
  }, []);

  // Sync clicked coordinates
  useEffect(() => {
    if (mapClickCoords && selectingCoordFor) {
      if (selectingCoordFor === 'pickup') {
        setPickupLat(mapClickCoords.lat.toFixed(6));
        setPickupLng(mapClickCoords.lng.toFixed(6));
        if (!pickupAddr) setPickupAddr(`Pickup: ${mapClickCoords.lat.toFixed(4)}, ${mapClickCoords.lng.toFixed(4)}`);
      } else if (selectingCoordFor === 'drop') {
        setDropLat(mapClickCoords.lat.toFixed(6));
        setDropLng(mapClickCoords.lng.toFixed(6));
        if (!dropAddr) setDropAddr(`Drop-off: ${mapClickCoords.lat.toFixed(4)}, ${mapClickCoords.lng.toFixed(4)}`);
      }
      setSelectingCoordFor(null);
      clearMapClickCoords();
    }
  }, [mapClickCoords, selectingCoordFor, clearMapClickCoords]);

  // Pricing calculation
  useEffect(() => {
    if (pickupLat && pickupLng && dropLat && dropLng) {
      onCalculateRates({
        pickup_lat: parseFloat(pickupLat), pickup_lng: parseFloat(pickupLng),
        drop_lat: parseFloat(dropLat), drop_lng: parseFloat(dropLng),
        dimensions: `${length}x${width}x${height}`, actual_weight: parseFloat(actualWeight),
        order_type: orderType, payment_type: paymentType, weather, traffic
      }).then(res => setPricingBreakdown(res));
    } else {
      setPricingBreakdown(null);
    }
  }, [pickupLat, pickupLng, dropLat, dropLng, length, width, height, actualWeight, orderType, paymentType, weather, traffic]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (!pickupLat || !dropLat) {
      alert('Select pickup and drop coordinates on the map.');
      return;
    }
    const order = await onPlaceOrder({
      customer_id: parseInt(selectedCustomerId),
      pickup_address: pickupAddr, pickup_lat: parseFloat(pickupLat), pickup_lng: parseFloat(pickupLng),
      drop_address: dropAddr, drop_lat: parseFloat(dropLat), drop_lng: parseFloat(dropLng),
      dimensions: `${length}x${width}x${height}`, actual_weight: parseFloat(actualWeight),
      order_type: orderType, payment_type: paymentType, weather, traffic
    });
    if (order) {
      alert(`Booking confirmed! Placed Order #${order.id} on behalf of customer.`);
      setPickupAddr(''); setPickupLat(''); setPickupLng('');
      setDropAddr(''); setDropLat(''); setDropLng('');
      setSelectedCustomerId('');
      setPricingBreakdown(null);
    }
  };

  const handleOrderVRPCheck = (id) => {
    setSelectedOrderIdsForVRP(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleVRPRun = () => {
    if (!selectedAgentForVRP || selectedOrderIdsForVRP.length === 0) {
      alert('Select an agent and at least one order to optimize routing path.');
      return;
    }
    onTriggerVRPOptimize(parseInt(selectedAgentForVRP), selectedOrderIdsForVRP);
  };

  const handleCreateZone = (e) => {
    e.preventDefault();
    if (!zoneName || !mapClickCoords) {
      alert('Enter a zone name and double click on the map to set the center point.');
      return;
    }
    onAddZone({ name: zoneName, center_lat: mapClickCoords.lat, center_lng: mapClickCoords.lng, radius_km: parseFloat(zoneRadius) });
    setZoneName('');
    clearMapClickCoords();
  };

  const routableOrders = orders.filter(o => ['Created', 'Assigned', 'In Transit', 'Out for Delivery'].includes(o.status));

  // Analytics helper calculations
  const b2bOrders = orders.filter(o => o.order_type === 'B2B');
  const b2cOrders = orders.filter(o => o.order_type === 'B2C');
  const b2bRevenue = b2bOrders.reduce((sum, o) => sum + o.total_charge, 0);
  const b2cRevenue = b2cOrders.reduce((sum, o) => sum + o.total_charge, 0);

  const analyticsData = [
    { name: 'B2B (Premium)', count: b2bOrders.length, revenue: b2bRevenue },
    { name: 'B2C (Economy)', count: b2cOrders.length, revenue: b2cRevenue }
  ];

  const riderChartData = agents
    .map(a => ({ name: a.username, points: a.points, rating: a.rating }))
    .sort((a, b) => b.points - a.points);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
        {['orders', 'zones', 'rates', 'leaderboard'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              flex: 1, padding: '0.75rem 0.5rem', background: 'transparent', border: 'none',
              borderBottom: activeSubTab === tab ? '2px solid #6366f1' : '2px solid transparent',
              color: activeSubTab === tab ? '#fff' : '#94a3b8', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {activeSubTab === 'orders' && (
          <div>
            <div className="glass-card">
              <h3 className="card-title"><Plus size={16} color="#10b981"/> Book on Behalf of Customer</h3>
              <form onSubmit={handleBooking}>
                <div className="form-group">
                  <label className="form-label">Select Customer Profile</label>
                  <select className="form-input" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} required>
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.username} ({c.email})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup Address</label>
                  <input type="text" className="form-input" placeholder="e.g. Warehouse A" value={pickupAddr} onChange={e => setPickupAddr(e.target.value)} required />
                  <button type="button" onClick={() => setSelectingCoordFor('pickup')} className="btn btn-secondary" style={{ padding: '0.35rem', fontSize: '0.7rem', marginTop: '0.35rem', width: 'auto' }}>
                    {selectingCoordFor === 'pickup' ? '📍 Click Map Location...' : '📍 Set Pickup Coords via Map'}
                  </button>
                  {pickupLat && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>Selected: {pickupLat}, {pickupLng}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Drop-off Address</label>
                  <input type="text" className="form-input" placeholder="e.g. Suite 302" value={dropAddr} onChange={e => setDropAddr(e.target.value)} required />
                  <button type="button" onClick={() => setSelectingCoordFor('drop')} className="btn btn-secondary" style={{ padding: '0.35rem', fontSize: '0.7rem', marginTop: '0.35rem', width: 'auto' }}>
                    {selectingCoordFor === 'drop' ? '📍 Click Map Location...' : '📍 Set Drop Coords via Map'}
                  </button>
                  {dropLat && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>Selected: {dropLat}, {dropLng}</div>}
                </div>

                <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input type="number" placeholder="L(cm)" className="form-input" value={length} onChange={e => setLength(parseInt(e.target.value))} required />
                  <input type="number" placeholder="W(cm)" className="form-input" value={width} onChange={e => setWidth(parseInt(e.target.value))} required />
                  <input type="number" placeholder="H(cm)" className="form-input" value={height} onChange={e => setHeight(parseInt(e.target.value))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Actual Weight (kg)</label>
                  <input type="number" step="0.1" className="form-input" value={actualWeight} onChange={e => setActualWeight(parseFloat(e.target.value))} required />
                </div>
                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">SLA Tier</label>
                    <select className="form-input" value={orderType} onChange={e => setOrderType(e.target.value)}>
                      <option value="B2C">B2C (Economy)</option>
                      <option value="B2B">B2B (Premium Express)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Payment Mode</label>
                    <select className="form-input" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">Cash on Delivery</option>
                    </select>
                  </div>
                </div>

                {pricingBreakdown && (
                  <div style={{ fontSize: '0.7rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Weight: {pricingBreakdown.billing_weight}kg</span><span>Base: ${pricingBreakdown.base_charge}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Route: {pricingBreakdown.pickup_zone_name} → {pricingBreakdown.drop_zone_name}</span><span>Zone: ${pricingBreakdown.zone_charge}</span></div>
                    {pricingBreakdown.weather_premium > 0 && <div style={{ display: 'flex', justify_content: 'space-between', color: '#38bdf8' }}><span>Weather Surcharge:</span><span>+${pricingBreakdown.weather_premium}</span></div>}
                    {pricingBreakdown.traffic_premium > 0 && <div style={{ display: 'flex', justify_content: 'space-between', color: '#f472b6' }}><span>Traffic Surcharge:</span><span>+${pricingBreakdown.traffic_premium}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.8rem', color: '#34d399', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                      <span>Dynamic Total:</span><span>${pricingBreakdown.total_charge.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <button type="submit" className="btn btn-accent">Confirm Admin Booking</button>
              </form>
            </div>

            <div className="glass-card">
              <h3 className="card-title"><Navigation size={16} color="#6366f1"/> Multi-Stop Route Optimizer</h3>
              <div className="form-group">
                <label className="form-label">Rider</label>
                <select className="form-input" value={selectedAgentForVRP} onChange={e => setSelectedAgentForVRP(e.target.value)}>
                  <option value="">-- Choose Rider --</option>
                  {agents.filter(a => a.status === 'active').map(agent => {
                    const isFull = agent.active_jobs >= 3;
                    return (
                      <option key={agent.id} value={agent.id} disabled={isFull}>
                        {agent.username} (Jobs: {agent.active_jobs || 0}/3){isFull ? ' [OCCUPIED]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group" style={{ maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '0.5rem', border: '1px solid var(--border-color)' }}>
                {routableOrders.length === 0 ? (
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>No deliveries available to route</div>
                ) : (
                  routableOrders.map(order => (
                    <label key={order.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', fontSize: '0.72rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedOrderIdsForVRP.includes(order.id)} onChange={() => handleOrderVRPCheck(order.id)} />
                      <span>Order #{order.id} - {order.pickup_address.substring(0, 15)}...</span>
                    </label>
                  ))
                )}
              </div>
              <button className="btn btn-accent" onClick={handleVRPRun} disabled={routableOrders.length === 0} style={{ fontSize: '0.75rem' }}>
                Solve Route Optimizer (TSP)
              </button>
            </div>

            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>Active Orders</h4>
            {orders.map(order => (
              <div key={order.id} className="glass-card" style={{ padding: '0.75rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong>Order #{order.id} ({order.order_type})</strong>
                  <span className={`status-badge status-${order.status.replace(/\s+/g, '')}`}>{order.status}</span>
                </div>
                <p>Pickup: {order.pickup_address}</p>
                <p>Drop: {order.drop_address}</p>
                <p>Cost: <strong>${order.total_charge.toFixed(2)}</strong></p>
                {order.status === 'Created' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn" onClick={() => onAutoAssign(order.id)} style={{ padding: '0.35rem', fontSize: '0.72rem' }}>Auto-Assign</button>
                    <select className="form-input" style={{ padding: '0.35rem', flex: 1 }} onChange={e => e.target.value && onManualAssign(order.id, parseInt(e.target.value))} defaultValue="">
                      <option value="" disabled>Manual Dispatch</option>
                      {agents.map(a => {
                        const isFull = a.active_jobs >= 3;
                        return (
                          <option key={a.id} value={a.id} disabled={isFull}>
                            {a.username} ({a.active_jobs || 0}/3 jobs){isFull ? ' [FULL]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                {order.agent_name && (
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginTop: '0.35rem' }}>
                    Assigned courier: <strong>{order.agent_name}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'zones' && (
          <div>
            <div className="glass-card">
              <h3 className="card-title"><Plus size={16} color="#6366f1"/> Add Zone Boundary</h3>
              <form onSubmit={handleCreateZone}>
                <div className="form-group">
                  <label className="form-label">Zone Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Brooklyn Center" value={zoneName} onChange={e => setZoneName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Radius (km)</label>
                  <input type="number" step="0.1" className="form-input" value={zoneRadius} onChange={e => setZoneRadius(e.target.value)} />
                </div>
                {mapClickCoords ? (
                  <div style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                    📍 Center Point: {mapClickCoords.lat.toFixed(4)}, {mapClickCoords.lng.toFixed(4)}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(245,158,11,0.05)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                    ⚠️ Double click the map to place the zone circle's center coordinates.
                  </p>
                )}
                <button type="submit" className="btn">Create Zone Circle</button>
              </form>
            </div>

            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>Active Zones</h4>
            {zones.map(zone => (
              <div key={zone.id} className="glass-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <div>
                  <strong>{zone.name}</strong>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Radius: {zone.radius_km}km</div>
                </div>
                <button onClick={() => onDeleteZone(zone.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'rates' && (
          <div>
            {rates.map(rate => (
              <RateCardEditor key={rate.id} rateCard={rate} onSave={(data) => onUpdateRates(rate.id, data)} />
            ))}
          </div>
        )}

        {activeSubTab === 'leaderboard' && (
          <div>
            <div className="glass-card">
              <h3 className="card-title"><Trophy size={16} color="#fbbf24"/> Rider Leaderboard</h3>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '1rem' }}>Riders earn 🏆 15 XP points on every successful geofenced delivery check.</p>
              <div className="leaderboard-list">
                {agents.sort((a,b) => b.points - a.points).map((agent, index) => (
                  <div key={agent.id} className="leaderboard-row">
                    <div className="leaderboard-rank">#{index + 1}</div>
                    <div className="leaderboard-name">{agent.username}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>⭐ {agent.rating.toFixed(1)}</span>
                      <span className="leaderboard-score">{agent.points} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <h3 className="card-title">Performance Analytics Visualizer</h3>
              <div style={{ width: '100%', height: 220, fontSize: '0.7rem' }}>
                <ResponsiveContainer>
                  <BarChart data={riderChartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                    <Tooltip contentStyle={{ background: '#111827', borderColor: 'rgba(255,255,255,0.1)' }} />
                    <Legend />
                    <Bar dataKey="points" fill="#6366f1" name="XP Points" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card">
              <h3 className="card-title">Revenue by Service Tier</h3>
              <div style={{ width: '100%', height: 200, fontSize: '0.7rem' }}>
                <ResponsiveContainer>
                  <AreaChart data={analyticsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#111827', borderColor: 'rgba(255,255,255,0.1)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="rgba(16, 185, 129, 0.15)" name="Revenue ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RateCardEditor({ rateCard, onSave }) {
  const [formData, setFormData] = useState({ ...rateCard });
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="glass-card">
      <h3 className="card-title">SLA Contract: {rateCard.order_type}</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Base Weight Limit (kg)</label>
            <input type="number" className="form-input" value={formData.base_weight_kg} onChange={e => setFormData({...formData, base_weight_kg: parseFloat(e.target.value)})} />
          </div>
          <div className="form-group">
            <label className="form-label">Base Rate ($)</label>
            <input type="number" className="form-input" value={formData.base_rate} onChange={e => setFormData({...formData, base_rate: parseFloat(e.target.value)})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Intra-Zone / kg</label>
            <input type="number" className="form-input" value={formData.intra_zone_rate_per_kg} onChange={e => setFormData({...formData, intra_zone_rate_per_kg: parseFloat(e.target.value)})} />
          </div>
          <div className="form-group">
            <label className="form-label">Inter-Zone / kg</label>
            <input type="number" className="form-input" value={formData.inter_zone_rate_per_kg} onChange={e => setFormData({...formData, inter_zone_rate_per_kg: parseFloat(e.target.value)})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">COD Surcharge Fee ($)</label>
          <input type="number" className="form-input" value={formData.cod_surcharge_flat} onChange={e => setFormData({...formData, cod_surcharge_flat: parseFloat(e.target.value)})} />
        </div>
        <button type="submit" className="btn btn-secondary">{saved ? 'Rates Updated!' : 'Save Rate Card'}</button>
      </form>
    </div>
  );
}

// ==========================================
// 3. CUSTOMER PORTAL COMPONENT
// ==========================================

function CustomerPortal({ orders, mapClickCoords, clearMapClickCoords, onCalculateRates, onPlaceOrder, onRescheduleOrder, weather, traffic, currentUser, getAuthHeaders }) {
  const [activeSubTab, setActiveSubTab] = useState('book');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  
  const [pickupAddr, setPickupAddr] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');

  const [dropAddr, setDropAddr] = useState('');
  const [dropLat, setDropLat] = useState('');
  const [dropLng, setDropLng] = useState('');

  const [length, setLength] = useState(30);
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  const [actualWeight, setActualWeight] = useState(1.5);
  const [orderType, setOrderType] = useState('B2C');
  const [paymentType, setPaymentType] = useState('Prepaid');
  const [selectingCoordFor, setSelectingCoordFor] = useState(null);
  const [pricingBreakdown, setPricingBreakdown] = useState(null);

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);

  useEffect(() => {
    if (rescheduleDate && selectedOrderId) {
      fetch(`/api/orders/${selectedOrderId}/reschedule-slots?date=${rescheduleDate}`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.slots)) {
            setRescheduleSlots(data.slots);
          }
        })
        .catch(err => console.error('Failed to load reschedule slots:', err));
    } else {
      setRescheduleSlots([]);
    }
  }, [rescheduleDate, selectedOrderId]);

  useEffect(() => {
    if (mapClickCoords && selectingCoordFor) {
      if (selectingCoordFor === 'pickup') {
        setPickupLat(mapClickCoords.lat.toFixed(6));
        setPickupLng(mapClickCoords.lng.toFixed(6));
        if (!pickupAddr) setPickupAddr(`Pickup: ${mapClickCoords.lat.toFixed(4)}, ${mapClickCoords.lng.toFixed(4)}`);
      } else if (selectingCoordFor === 'drop') {
        setDropLat(mapClickCoords.lat.toFixed(6));
        setDropLng(mapClickCoords.lng.toFixed(6));
        if (!dropAddr) setDropAddr(`Drop-off: ${mapClickCoords.lat.toFixed(4)}, ${mapClickCoords.lng.toFixed(4)}`);
      }
      setSelectingCoordFor(null);
      clearMapClickCoords();
    }
  }, [mapClickCoords, selectingCoordFor, clearMapClickCoords]);

  useEffect(() => {
    if (pickupLat && pickupLng && dropLat && dropLng) {
      onCalculateRates({
        pickup_lat: parseFloat(pickupLat), pickup_lng: parseFloat(pickupLng),
        drop_lat: parseFloat(dropLat), drop_lng: parseFloat(dropLng),
        dimensions: `${length}x${width}x${height}`, actual_weight: parseFloat(actualWeight),
        order_type: orderType, payment_type: paymentType, weather, traffic
      }).then(res => setPricingBreakdown(res));
    } else {
      setPricingBreakdown(null);
    }
  }, [pickupLat, pickupLng, dropLat, dropLng, length, width, height, actualWeight, orderType, paymentType, weather, traffic]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!pickupLat || !dropLat) {
      alert('Select pickup and drop positions on the map.');
      return;
    }
    const order = await onPlaceOrder({
      pickup_address: pickupAddr, pickup_lat: parseFloat(pickupLat), pickup_lng: parseFloat(pickupLng),
      drop_address: dropAddr, drop_lat: parseFloat(dropLat), drop_lng: parseFloat(dropLng),
      dimensions: `${length}x${width}x${height}`, actual_weight: parseFloat(actualWeight),
      order_type: orderType, payment_type: paymentType, weather, traffic
    });
    if (order) {
      alert(`Booking confirmed! Order ID: #${order.id}`);
      setPickupAddr(''); setPickupLat(''); setPickupLng('');
      setDropAddr(''); setDropLat(''); setDropLng('');
      setPricingBreakdown(null);
      setActiveSubTab('track');
      setSelectedOrderId(order.id);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate) return alert('Choose a date to reschedule.');
    if (!selectedRescheduleSlot) return alert('Please select a delivery slot.');
    await onRescheduleOrder(selectedOrderId, rescheduleDate, selectedRescheduleSlot);
    setRescheduleDate('');
    setSelectedRescheduleSlot('');
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
        <button onClick={() => setActiveSubTab('book')} style={{ flex: 1, padding: '0.75rem 0.5rem', background: 'transparent', border: 'none', borderBottom: activeSubTab === 'book' ? '2px solid #6366f1' : '2px solid transparent', color: activeSubTab === 'book' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Book Courier</button>
        <button onClick={() => setActiveSubTab('track')} style={{ flex: 1, padding: '0.75rem 0.5rem', background: 'transparent', border: 'none', borderBottom: activeSubTab === 'track' ? '2px solid #6366f1' : '2px solid transparent', color: activeSubTab === 'track' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Track Delivery</button>
      </div>

      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        {activeSubTab === 'book' && (
          <form onSubmit={handleBooking}>
            <div className="glass-card">
              <h3 className="card-title"><MapPin size={16} color="#10b981"/> Pickup & Drop Coordinates</h3>
              <div className="form-group">
                <label className="form-label">Pickup Address Description</label>
                <input type="text" className="form-input" placeholder="e.g. Building A Entrance" value={pickupAddr} onChange={e => setPickupAddr(e.target.value)} required />
                <button type="button" onClick={() => setSelectingCoordFor('pickup')} className="btn btn-secondary" style={{ padding: '0.35rem', fontSize: '0.7rem', marginTop: '0.35rem', width: 'auto' }}>
                  {selectingCoordFor === 'pickup' ? '📍 Click Map Location...' : '📍 Set Pickup Coords via Map'}
                </button>
                {pickupLat && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>Selected: {pickupLat}, {pickupLng}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Drop-off Address Description</label>
                <input type="text" className="form-input" placeholder="e.g. Office Suite 501" value={dropAddr} onChange={e => setDropAddr(e.target.value)} required />
                <button type="button" onClick={() => setSelectingCoordFor('drop')} className="btn btn-secondary" style={{ padding: '0.35rem', fontSize: '0.7rem', marginTop: '0.35rem', width: 'auto' }}>
                  {selectingCoordFor === 'drop' ? '📍 Click Map Location...' : '📍 Set Drop Coords via Map'}
                </button>
                {dropLat && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>Selected: {dropLat}, {dropLng}</div>}
              </div>
            </div>

            <div className="glass-card">
              <h3 className="card-title"><Calculator size={16} color="#6366f1"/> Sizing & Actual Weight</h3>
              <div className="form-label">Dimensions: L × W × H (cm)</div>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <input type="number" className="form-input" value={length} onChange={e => setLength(parseInt(e.target.value))} required />
                <input type="number" className="form-input" value={width} onChange={e => setWidth(parseInt(e.target.value))} required />
                <input type="number" className="form-input" value={height} onChange={e => setHeight(parseInt(e.target.value))} required />
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Actual Weight (kg)</label>
                <input type="number" step="0.1" className="form-input" value={actualWeight} onChange={e => setActualWeight(parseFloat(e.target.value))} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SLA Tier</label>
                  <select className="form-input" value={orderType} onChange={e => setOrderType(e.target.value)}>
                    <option value="B2C">B2C (Economy)</option>
                    <option value="B2B">B2B (Premium Express)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select className="form-input" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                    <option value="Prepaid">Prepaid</option>
                    <option value="COD">Cash on Delivery</option>
                  </select>
                </div>
              </div>
            </div>

            {pricingBreakdown && (
              <div className="glass-card" style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                <h3 className="card-title"><Calculator size={14}/> Sandbox Rate Card Lookup</h3>
                <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justify: 'space-between' }}>
                    <span>Billing Weight (max of act vs vol):</span>
                    <strong>{pricingBreakdown.billing_weight} kg</strong>
                  </div>
                  <div style={{ display: 'flex', justify: 'space-between' }}>
                    <span>Detected Zones:</span>
                    <span>{pricingBreakdown.pickup_zone_name} → {pricingBreakdown.drop_zone_name}</span>
                  </div>
                  <div style={{ display: 'flex', justify: 'space-between' }}>
                    <span>Base Fare:</span>
                    <span>${pricingBreakdown.base_charge.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justify: 'space-between' }}>
                    <span>Weight Distance Surcharges:</span>
                    <span>${pricingBreakdown.zone_charge.toFixed(2)}</span>
                  </div>
                  {pricingBreakdown.cod_surcharge > 0 && <div style={{ display: 'flex', justify: 'space-between', color: '#fbbf24' }}><span>COD Surcharge Flat:</span><span>+${pricingBreakdown.cod_surcharge.toFixed(2)}</span></div>}
                  {pricingBreakdown.weather_premium > 0 && <div style={{ display: 'flex', justify: 'space-between', color: '#38bdf8' }}><span>Weather Premium:</span><span>+${pricingBreakdown.weather_premium.toFixed(2)}</span></div>}
                  {pricingBreakdown.traffic_premium > 0 && <div style={{ display: 'flex', justify: 'space-between', color: '#f472b6' }}><span>Traffic Congestion:</span><span>+${pricingBreakdown.traffic_premium.toFixed(2)}</span></div>}
                  <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justify: 'space-between', fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                    <span>Dynamic Total:</span>
                    <span style={{ color: '#10b981' }}>${pricingBreakdown.total_charge.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            <button type="submit" className="btn btn-accent">Confirm Booking</button>
          </form>
        )}

        {activeSubTab === 'track' && (
          <div>
            <div className="form-group">
              <label className="form-label">Active Orders</label>
              <select className="form-input" value={selectedOrderId || ''} onChange={e => setSelectedOrderId(parseInt(e.target.value))}>
                <option value="">-- Choose Placed Order --</option>
                {orders.map(o => <option key={o.id} value={o.id}>Order #{o.id} - {o.pickup_address.substring(0, 10)}... ({o.status})</option>)}
              </select>
            </div>

            {selectedOrder && (
              <div>
                {selectedOrder.status === 'Failed' && (
                  <div className="glass-card" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
                    <h3 className="card-title" style={{ color: '#f87171' }}><AlertTriangle size={16}/> Reschedule Failed Attempt</h3>
                    <p style={{ fontSize: '0.72rem', color: '#fca5a5', marginBottom: '0.75rem' }}>Select a green high-efficiency co-routing slot below where riders already pass near your area to earn discounts.</p>
                    <div className="form-group">
                      <label className="form-label">New Reschedule Date</label>
                      <input type="date" className="form-input" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
                    </div>
                    <div className="heatmap-grid">
                      {rescheduleSlots.length > 0 ? (
                        rescheduleSlots.map(slot => {
                          const isHigh = slot.efficiency >= 70;
                          const isSelected = selectedRescheduleSlot === slot.name;
                          return (
                            <div 
                              key={slot.name}
                              className={`heatmap-slot ${isHigh ? 'efficiency-high' : 'efficiency-medium'} ${isSelected ? 'selected' : ''}`} 
                              onClick={() => setSelectedRescheduleSlot(slot.name)}
                            >
                              <div>{slot.label}</div>
                              <div style={{ fontSize: '0.55rem', opacity: 0.8 }}>
                                {slot.efficiency}% Efficient {isHigh ? '🌱' : ''}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ gridColumn: 'span 3', fontSize: '0.72rem', color: '#cbd5e1', textAlign: 'center', padding: '0.5rem' }}>
                          Enter a reschedule date to see high-efficiency co-routing slots...
                        </div>
                      )}
                    </div>
                    {selectedRescheduleSlot && rescheduleSlots.length > 0 && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.05)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                        {rescheduleSlots.find(s => s.name === selectedRescheduleSlot)?.efficiency >= 70 ? (
                          <span>🌱 Co-routing match found! Rescheduling to this slot awards a 10% Green Discount.</span>
                        ) : (
                          <span style={{ color: '#fbbf24' }}>Standard slot selected. Select a slot marked 🌱 to receive a co-routing discount.</span>
                        )}
                      </div>
                    )}
                    <button type="button" className="btn btn-accent" onClick={handleReschedule} style={{ marginTop: '1rem' }}>Reschedule Order</button>
                  </div>
                )}

                <div className="glass-card">
                  <h3 className="card-title"><ShoppingBag size={16} color="#6366f1"/> Immutable Audit Trail</h3>
                  <div className="timeline">
                    {selectedOrder.history && selectedOrder.history.map((log, index) => (
                      <div key={log.id} className="timeline-item">
                        <div className={`timeline-dot ${index === selectedOrder.history.length - 1 ? 'active' : ''}`} />
                        <div className="timeline-content">
                          <div className="timeline-title">{log.to_status}</div>
                          <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{log.remarks}</div>
                          <div className="timeline-time">By: {log.updated_by_username} | {new Date(log.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interactive Live Chat */}
                {['Assigned', 'Picked Up', 'In Transit', 'Out for Delivery'].includes(selectedOrder.status) && (
                  <div className="glass-card" style={{ padding: '0.75rem' }}>
                    <ChatPanel orderId={selectedOrder.id} currentUser={currentUser} getAuthHeaders={getAuthHeaders} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. AGENT PORTAL (MOBILE PHONE SIMULATOR)
// ==========================================

function AgentPortal({ agents, orders, onUpdateStatus, onSimulateGPS, currentUser, getAuthHeaders }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [failedRemarks, setFailedRemarks] = useState('');
  const [gpsSteps, setGpsSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSimulatingMove, setIsSimulatingMove] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role === 'agent') {
      setSelectedAgentId(currentUser.id.toString());
    }
  }, [currentUser]);

  const activeAgent = agents.find(a => a.id === parseInt(selectedAgentId));
  const assignedOrders = orders.filter(o => o.agent_id === parseInt(selectedAgentId) && o.status !== 'Delivered');

  useEffect(() => {
    if (assignedOrders.length > 0) {
      if (!selectedOrderId || !assignedOrders.find(o => o.id === parseInt(selectedOrderId))) {
        setSelectedOrderId(assignedOrders[0].id.toString());
      }
    } else {
      setSelectedOrderId('');
    }
  }, [selectedAgentId, orders]);

  const selectedOrder = orders.find(o => o.id === parseInt(selectedOrderId));

  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R * 1000;
  };

  const distanceToDrop = selectedOrder && activeAgent
    ? getDistanceMeters(activeAgent.current_lat, activeAgent.current_lng, selectedOrder.drop_lat, selectedOrder.drop_lng)
    : Infinity;

  const isWithinGeofence = distanceToDrop <= 150;

  const handleStartGPSSimulation = () => {
    if (!activeAgent || !selectedOrder) return;
    setIsSimulatingMove(true);
    setCurrentStepIndex(0);

    const startLat = activeAgent.current_lat;
    const startLng = activeAgent.current_lng;
    const stepsCount = 10;
    const pathSteps = [];

    for (let i = 1; i <= stepsCount; i++) {
      const ratio = i / stepsCount;
      pathSteps.push({ lat: startLat + (selectedOrder.pickup_lat - startLat) * ratio, lng: startLng + (selectedOrder.pickup_lng - startLng) * ratio });
    }
    for (let i = 1; i <= stepsCount; i++) {
      const ratio = i / stepsCount;
      pathSteps.push({ lat: selectedOrder.pickup_lat + (selectedOrder.drop_lat - selectedOrder.pickup_lat) * ratio, lng: selectedOrder.pickup_lng + (selectedOrder.drop_lng - selectedOrder.pickup_lng) * ratio });
    }
    setGpsSteps(pathSteps);
  };

  useEffect(() => {
    if (isSimulatingMove && gpsSteps.length > 0 && currentStepIndex < gpsSteps.length) {
      const timer = setTimeout(async () => {
        const step = gpsSteps[currentStepIndex];
        await onSimulateGPS(parseInt(selectedAgentId), step.lat, step.lng);
        setCurrentStepIndex(prev => prev + 1);
      }, 700);
      return () => clearTimeout(timer);
    } else if (currentStepIndex >= gpsSteps.length && isSimulatingMove) {
      setIsSimulatingMove(false);
      alert('Courier has reached coordinates.');
    }
  }, [isSimulatingMove, currentStepIndex, gpsSteps]);

  const handleUpdateStatus = async (status) => {
    const remarks = status === 'Failed' ? failedRemarks : '';
    try {
      await onUpdateStatus(parseInt(selectedOrderId), status, remarks);
      setFailedRemarks('');
    } catch (e) {
      alert(e.message || 'Status update blocked.');
    }
  };

  return (
    <div>
      {(!currentUser || currentUser.role !== 'agent') && (
        <div className="glass-card">
          <h3 className="card-title"><Compass size={16} color="#6366f1"/> Select Active Courier</h3>
          <select className="form-input" value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}>
            <option value="">-- Choose Rider --</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.username} (🏆 {a.points} XP) - {a.active_jobs || 0}/3 active jobs
              </option>
            ))}
          </select>
        </div>
      )}

      {activeAgent ? (
        <div className="phone-wrapper">
          <div className="phone-header">
            <h4>COURIER APP SCREEN</h4>
          </div>
          <div className="phone-screen">
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
              <div>GPS Position: {activeAgent.current_lat.toFixed(4)}, {activeAgent.current_lng.toFixed(4)}</div>
              <div>Rating: ⭐ {activeAgent.rating.toFixed(1)} | Score: {activeAgent.points} XP</div>
              <div>Current Load: <strong>{activeAgent.active_jobs || 0} / 3 Active Jobs</strong></div>
            </div>

            <h4 style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '0.5rem', fontWeight: 600 }}>Active Jobs</h4>
            {assignedOrders.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', margin: '2rem 0' }}>No active assignments.</p>
            ) : (
              <div>
                <select className="form-input" value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)} style={{ marginBottom: '0.75rem' }}>
                  {assignedOrders.map(o => <option key={o.id} value={o.id}>Job #{o.id} - ({o.status})</option>)}
                </select>

                {selectedOrder && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>Status: {selectedOrder.status}</div>
                      <p>Pickup Address: {selectedOrder.pickup_address}</p>
                      <p>Drop Address: {selectedOrder.drop_address}</p>
                      
                      <button type="button" className="btn" onClick={handleStartGPSSimulation} disabled={isSimulatingMove} style={{ padding: '0.4rem', fontSize: '0.75rem', margin: '0.75rem 0' }}>
                        {isSimulatingMove ? `Simulating Move (${currentStepIndex}/${gpsSteps.length})...` : '🚗 Simulate Route Steps'}
                      </button>

                      {selectedOrder.status !== 'Delivered' && (
                        <div style={{
                          padding: '0.5rem', borderRadius: '6px', fontSize: '0.7rem', marginBottom: '0.75rem',
                          background: isWithinGeofence ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: isWithinGeofence ? '#34d399' : '#f87171',
                          border: `1px solid ${isWithinGeofence ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          display: 'flex', alignItems: 'center', gap: '0.25rem'
                        }}>
                          {isWithinGeofence ? <><CheckCircle2 size={12}/> Geofence Active (Within {Math.round(distanceToDrop)}m)</> : <><ShieldAlert size={12}/> Geofence Locked ({Math.round(distanceToDrop)}m away - must be &lt; 150m)</>}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {selectedOrder.status === 'Assigned' && <button className="btn btn-secondary" onClick={() => handleUpdateStatus('Picked Up')}>Mark Picked Up</button>}
                        {selectedOrder.status === 'Picked Up' && <button className="btn btn-secondary" onClick={() => handleUpdateStatus('In Transit')}>Start Transit</button>}
                        {selectedOrder.status === 'In Transit' && <button className="btn btn-secondary" onClick={() => handleUpdateStatus('Out for Delivery')}>Out for Delivery</button>}
                        {(selectedOrder.status === 'Out for Delivery' || selectedOrder.status === 'In Transit') && (
                          <>
                            <button className="btn btn-accent" onClick={() => handleUpdateStatus('Delivered')} disabled={!isWithinGeofence}>Mark Delivered</button>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                              <input type="text" className="form-input" placeholder="Fail reason..." value={failedRemarks} onChange={e => setFailedRemarks(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.75rem', marginBottom: '0.35rem' }} />
                              <button className="btn btn-danger" onClick={() => handleUpdateStatus('Failed')}>Mark Failed</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Interactive Live Chat */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <ChatPanel orderId={selectedOrder.id} currentUser={currentUser} getAuthHeaders={getAuthHeaders} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>Select an active rider to simulate their courier phone view.</p>
      )}
    </div>
  );
}

// ==========================================
// 5. NOTIFICATION AUDIT VIEW COMPONENT
// ==========================================

function NotificationsBar({ notifications, onRefresh }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="notifications-header">
        <h3 className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          <Mail size={16} color="#c7d2fe"/> Communications Log
        </h3>
        <button onClick={onRefresh} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <RefreshCw size={14} />
        </button>
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Audit logging of triggered transactional SMS and structured HTML emails.</p>

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>No logs generated yet.</div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className="notification-item">
              <div className="notification-meta">
                <span className={`notification-type ${notif.type}`} style={{ color: notif.type === 'Email' ? '#a78bfa' : '#38bdf8' }}>{notif.type}</span>
                <span>{new Date(notif.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '0.72rem', marginBottom: '0.25rem' }}>Recipient: {notif.recipient}</div>
              {notif.type === 'Email' ? (
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.4rem', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.75rem' }}>{notif.message.split('\n\n')[0]}</div>
                  <div dangerouslySetInnerHTML={{ __html: notif.message.split('\n\n')[1] || notif.message }} style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '0.25rem' }} />
                </div>
              ) : (
                <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '0.5rem', borderRadius: '8px', color: '#e0f2fe' }}>
                  {notif.message}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==========================================
// 6. MAIN UNIFIED APP DASHBOARD VIEW
// ==========================================

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('lastmile_token');
    const stored = localStorage.getItem('lastmile_user');
    // Only restore session if both token AND user data exist
    if (token && stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    // Clear any stale data
    localStorage.removeItem('lastmile_user');
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
    const token = localStorage.getItem('lastmile_token');
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleLoginSuccess = ({ token, user }) => {
    localStorage.setItem('lastmile_token', token);
    localStorage.setItem('lastmile_user', JSON.stringify(user));
    setCurrentUser(user);
    if (user.role === 'customer') setActiveTab('customer');
    else if (user.role === 'agent') setActiveTab('agent');
    else if (user.role === 'admin') setActiveTab('admin');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('lastmile_token');
    localStorage.removeItem('lastmile_user');
  };

  const loadAllData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const contentHeaders = { 'Content-Type': 'application/json', ...authHeaders };

      // Always fetch agents and zones (needed for map)
      const agentPromise = fetch('/api/agents', { headers: authHeaders }).then(r => r.json());
      const zonePromise = fetch('/api/zones', { headers: authHeaders }).then(r => r.json());

      const [resAgents, resZones] = await Promise.all([agentPromise, zonePromise]);
      if (Array.isArray(resAgents)) setAgents(resAgents);
      if (Array.isArray(resZones)) setZones(resZones);

      // Orders are always scoped by role server-side
      const resOrders = await fetch('/api/orders', { headers: authHeaders }).then(r => r.json());
      if (Array.isArray(resOrders)) setOrders(resOrders);

      // Admin-only data
      if (currentUser?.role === 'admin') {
        const [resRates, resNotifs] = await Promise.all([
          fetch('/api/rates', { headers: authHeaders }).then(r => r.json()),
          fetch('/api/notifications', { headers: authHeaders }).then(r => r.json())
        ]);
        if (Array.isArray(resRates)) setRates(resRates);
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

  return (
    <div className="app-container">
      {!currentUser && (
        <AuthOverlay onLoginSuccess={handleLoginSuccess} />
      )}

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
