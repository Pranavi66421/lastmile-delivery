import React, { useState } from 'react';

export default function RateCardEditor({ rateCard, onSave }) {
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
