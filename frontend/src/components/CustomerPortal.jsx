import React, { useState, useEffect } from 'react';
import { MapPin, Calculator, ShoppingBag, AlertTriangle } from 'lucide-react';
import ChatPanel from './ChatPanel';

export default function CustomerPortal({ orders, mapClickCoords, clearMapClickCoords, onCalculateRates, onPlaceOrder, onRescheduleOrder, weather, traffic, currentUser, getAuthHeaders }) {
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
  const [orderDetail, setOrderDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  useEffect(() => {
    if (!selectedOrderId) { setOrderDetail(null); return; }
    setLoadingDetail(true);
    const token = sessionStorage.getItem('lastmile_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/orders/${selectedOrderId}`, { headers })
      .then(r => r.json())
      .then(data => { if (data && data.id) setOrderDetail(data); })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedOrderId]);

  useEffect(() => {
    if (rescheduleDate && selectedOrderId) {
      const token = sessionStorage.getItem('lastmile_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      fetch(`/api/orders/${selectedOrderId}/reschedule-slots?date=${rescheduleDate}`, { headers })
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
      setBookingSuccess(order);
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
    // Refresh order detail after reschedule
    const token = sessionStorage.getItem('lastmile_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/orders/${selectedOrderId}`, { headers })
      .then(r => r.json())
      .then(data => { if (data && data.id) setOrderDetail(data); });
  };

  const handleRateAgent = async (rating) => {
    try {
      const token = sessionStorage.getItem('lastmile_token');
      const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/orders/${selectedOrderId}/rate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating })
      }).then(r => r.json());
      if (res.error) alert(res.error);
      else alert('Thank you for rating your rider!');
    } catch (e) {
      alert('Failed to submit rating.');
    }
  };

  const selectedOrder = orderDetail; // always use full detail with history

  const STATUS_COLORS = {
    'Created': '#3b82f6', 'Assigned': '#8b5cf6', 'Picked Up': '#f59e0b',
     'In Transit': '#06b6d4', 'Out for Delivery': '#ec4899', 'Delivered': '#10b981', 'Failed': '#ef4444'
  };
  const STATUS_ICONS = {
    'Created': '📦', 'Assigned': '🏍️', 'Picked Up': '📤',
    'In Transit': '🚚', 'Out for Delivery': '📍', 'Delivered': '✅', 'Failed': '❌'
  };

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
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Billing Weight (max of act vs vol):</span>
                    <strong>{pricingBreakdown.billing_weight} kg</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Detected Zones:</span>
                    <span>{pricingBreakdown.pickup_zone_name} → {pricingBreakdown.drop_zone_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Base Fare:</span>
                    <span>${pricingBreakdown.base_charge.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Weight Distance Surcharges:</span>
                    <span>${pricingBreakdown.zone_charge.toFixed(2)}</span>
                  </div>
                  {pricingBreakdown.cod_surcharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}><span>COD Surcharge Flat:</span><span>+${pricingBreakdown.cod_surcharge.toFixed(2)}</span></div>}
                  {pricingBreakdown.weather_premium > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}><span>Weather Premium:</span><span>+${pricingBreakdown.weather_premium.toFixed(2)}</span></div>}
                  {pricingBreakdown.traffic_premium > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f472b6' }}><span>Traffic Congestion:</span><span>+${pricingBreakdown.traffic_premium.toFixed(2)}</span></div>}
                  <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.5rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
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
            {bookingSuccess && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎉</div>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.85rem' }}>Order #{bookingSuccess.id} Confirmed!</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>Total: <strong style={{ color: '#fff' }}>${bookingSuccess.total_charge?.toFixed(2)}</strong> · {bookingSuccess.order_type} · {bookingSuccess.payment_type}</div>
                <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.5rem' }}>A rider will be auto-assigned shortly.</div>
                <button onClick={() => setBookingSuccess(null)} style={{ marginTop: '0.5rem', fontSize: '0.65rem', background: 'transparent', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer' }}>Dismiss</button>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShoppingBag size={13} color="#6366f1" /> Your Orders
              </label>
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                  No orders yet. Place your first booking!
                  <br/><button onClick={() => setActiveSubTab('book')} style={{ marginTop: '0.75rem', fontSize: '0.75rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: '8px', padding: '0.4rem 1rem', cursor: 'pointer' }}>📦 Book a Courier</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {orders.map(o => {
                    const color = STATUS_COLORS[o.status] || '#94a3b8';
                    const icon = STATUS_ICONS[o.status] || '📦';
                    const isSelected = selectedOrderId === o.id;
                    return (
                      <div
                        key={o.id}
                        onClick={() => setSelectedOrderId(o.id)}
                        style={{
                          background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: '8px', padding: '0.65rem 0.75rem', cursor: 'pointer',
                          transition: 'all 0.15s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0' }}>Order #{o.id}</div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.pickup_address} → {o.drop_address}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            {icon} {o.status}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '0.1rem' }}>${o.total_charge?.toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {loadingDetail && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>⏳</div> Loading order details...
              </div>
            )}

            {selectedOrder && !loadingDetail && (
              <div>
                <div className="glass-card" style={{ background: `rgba(${selectedOrder.status === 'Delivered' ? '16,185,129' : selectedOrder.status === 'Failed' ? '239,68,68' : '99,102,241'},0.08)`, borderColor: `${STATUS_COLORS[selectedOrder.status] || '#6366f1'}44`, marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>ORDER #{selectedOrder.id}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: STATUS_COLORS[selectedOrder.status] || '#fff' }}>
                        {STATUS_ICONS[selectedOrder.status]} {selectedOrder.status}
                      </div>
                      {selectedOrder.agent_name && (
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>🏍️ Rider: <strong style={{ color: '#e2e8f0' }}>{selectedOrder.agent_name}</strong></div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{selectedOrder.order_type} · {selectedOrder.payment_type}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>${selectedOrder.total_charge?.toFixed(2)}</div>
                      {selectedOrder.discount_applied ? <div style={{ fontSize: '0.6rem', color: '#34d399' }}>🌱 10% co-routing discount applied</div> : null}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.65rem', color: '#94a3b8' }}>
                    <div><span style={{ color: '#6b7280' }}>📤 From:</span><br/><span style={{ color: '#e2e8f0' }}>{selectedOrder.pickup_address}</span></div>
                    <div><span style={{ color: '#6b7280' }}>📍 To:</span><br/><span style={{ color: '#e2e8f0' }}>{selectedOrder.drop_address}</span></div>
                    <div>Weight: <strong style={{ color: '#e2e8f0' }}>{selectedOrder.billing_weight} kg</strong></div>
                    <div>Placed: <strong style={{ color: '#e2e8f0' }}>{new Date(selectedOrder.created_at).toLocaleDateString()}</strong></div>
                  </div>
                </div>

                {selectedOrder.status === 'Delivered' && (
                  <div className="glass-card" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)', textAlign: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#34d399', marginBottom: '0.5rem' }}>How was your delivery?</h4>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => handleRateAgent(star)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseOver={e => e.target.style.transform = 'scale(1.2)'} onMouseOut={e => e.target.style.transform = 'scale(1)'}>
                          ⭐
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.5rem' }}>Tap a star to rate rider {selectedOrder.agent_name}</div>
                  </div>
                )}

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
                    {selectedOrder.history && selectedOrder.history.length > 0 ? (
                      selectedOrder.history.map((log, index) => (
                        <div key={log.id} className="timeline-item">
                          <div className={`timeline-dot ${index === selectedOrder.history.length - 1 ? 'active' : ''}`} />
                          <div className="timeline-content">
                            <div className="timeline-title">{log.to_status}</div>
                            <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>{log.remarks}</div>
                            <div className="timeline-time">By: {log.updated_by_username} | {new Date(log.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '0.75rem' }}>No history events yet.</div>
                    )}
                  </div>
                </div>

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
