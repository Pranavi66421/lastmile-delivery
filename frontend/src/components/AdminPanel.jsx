import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Navigation, Trophy } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import RateCardEditor from './RateCardEditor';

export default function AdminPanel({ zones, orders, agents, rates, onAddZone, onDeleteZone, onUpdateRates, onAutoAssign, onManualAssign, onTriggerVRPOptimize, mapClickCoords, clearMapClickCoords, onCalculateRates, onPlaceOrder, weather, traffic, getAuthHeaders }) {
  const [activeSubTab, setActiveSubTab] = useState('orders');
  const [zoneName, setZoneName] = useState('');
  const [zoneRadius, setZoneRadius] = useState(3.0);
  const [selectedAgentForVRP, setSelectedAgentForVRP] = useState('');
  const [selectedOrderIdsForVRP, setSelectedOrderIdsForVRP] = useState([]);

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

  useEffect(() => {
    const token = sessionStorage.getItem('lastmile_token');
    fetch('/api/customers', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCustomers(data); })
      .catch(console.error);
  }, []);

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
  }, [mapClickCoords, selectingCoordFor, clearMapClickCoords, pickupAddr, dropAddr]);

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
  }, [pickupLat, pickupLng, dropLat, dropLng, length, width, height, actualWeight, orderType, paymentType, weather, traffic, onCalculateRates]);

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
                    {pricingBreakdown.weather_premium > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}><span>Weather Surcharge:</span><span>+${pricingBreakdown.weather_premium}</span></div>}
                    {pricingBreakdown.traffic_premium > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f472b6' }}><span>Traffic Surcharge:</span><span>+${pricingBreakdown.traffic_premium}</span></div>}
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
