import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

export default function MapComponent({ zones, orders, agents, activeSelection, onMapClick, optimizedRoute, selectedOrderId }) {
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
