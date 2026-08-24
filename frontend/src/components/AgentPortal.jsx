import React, { useState, useEffect } from 'react';
import { Compass, CheckCircle2, ShieldAlert } from 'lucide-react';
import ChatPanel from './ChatPanel';

export default function AgentPortal({ agents, orders, onUpdateStatus, onSimulateGPS, currentUser, getAuthHeaders }) {
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
  }, [selectedAgentId, orders, selectedOrderId, assignedOrders]);

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
  }, [isSimulatingMove, currentStepIndex, gpsSteps, onSimulateGPS, selectedAgentId]);

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
