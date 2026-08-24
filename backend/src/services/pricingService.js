const { get } = require('../config/db');
const { detectZone } = require('./geoService');

function calculateVolumetricWeight(dimensions) {
  if (!dimensions || typeof dimensions !== 'string') return 0;
  const parts = dimensions.toLowerCase().split('x').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  const [l, w, h] = parts;
  return (l * w * h) / 5000;
}

async function calculateOrderCharge(orderDetails) {
  const {
    pickup_lat, pickup_lng, drop_lat, drop_lng,
    dimensions, actual_weight, order_type, payment_type,
    weather = 'Sunny', traffic = 'Light'
  } = orderDetails;

  const pickupZone = await detectZone(pickup_lat, pickup_lng);
  const dropZone = await detectZone(drop_lat, drop_lng);

  const pickup_zone_id = pickupZone ? pickupZone.id : null;
  const drop_zone_id = dropZone ? dropZone.id : null;

  const volumetricWeight = calculateVolumetricWeight(dimensions);
  const billingWeight = Math.max(actual_weight, volumetricWeight);

  const rateCard = await get('SELECT * FROM rate_cards WHERE order_type = ?', [order_type]);
  if (!rateCard) throw new Error(`Rate card not found for: ${order_type}`);

  const isIntraZone = (pickup_zone_id !== null && drop_zone_id !== null && pickup_zone_id === drop_zone_id);
  const perKgRate = isIntraZone ? rateCard.intra_zone_rate_per_kg : rateCard.inter_zone_rate_per_kg;

  const baseCharge = rateCard.base_rate;
  const extraWeight = Math.max(0, billingWeight - rateCard.base_weight_kg);
  const zoneCharge = extraWeight * perKgRate;

  let codSurcharge = payment_type === 'COD' ? rateCard.cod_surcharge_flat : 0;
  const subtotal = baseCharge + zoneCharge + codSurcharge;

  let weatherPremiumPercent = weather === 'Rainy' ? 0.10 : (weather === 'Stormy' ? 0.20 : 0);
  let trafficPremiumPercent = traffic === 'Moderate' ? 0.08 : (traffic === 'Gridlock' ? 0.15 : 0);

  const weatherPremium = Number((subtotal * weatherPremiumPercent).toFixed(2));
  const trafficPremium = Number((subtotal * trafficPremiumPercent).toFixed(2));
  const totalCharge = Number((subtotal + weatherPremium + trafficPremium).toFixed(2));

  return {
    pickup_zone_id,
    drop_zone_id,
    pickup_zone_name: pickupZone ? pickupZone.name : 'Out of Mapped Area',
    drop_zone_name: dropZone ? dropZone.name : 'Out of Mapped Area',
    volumetric_weight: Number(volumetricWeight.toFixed(2)),
    billing_weight: Number(billingWeight.toFixed(2)),
    isIntraZone,
    base_charge: Number(baseCharge.toFixed(2)),
    zone_charge: Number(zoneCharge.toFixed(2)),
    cod_surcharge: Number(codSurcharge.toFixed(2)),
    weather_premium: weatherPremium,
    traffic_premium: trafficPremium,
    total_charge: totalCharge
  };
}

module.exports = {
  calculateVolumetricWeight,
  calculateOrderCharge
};
