import React from 'react';
import { Mail, RefreshCw } from 'lucide-react';

export default function NotificationsBar({ notifications, onRefresh }) {
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
