const { all } = require('../config/db');

function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function detectZone(lat, lng) {
  const list = await all('SELECT * FROM zones');
  let closestZone = null;
  let minDistance = Infinity;

  for (const zone of list) {
    const dist = getDistanceKM(lat, lng, zone.center_lat, zone.center_lng);
    if (dist <= zone.radius_km) {
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    }
  }
  return closestZone;
}

function verifyGeofence(agentLat, agentLng, dropLat, dropLng, thresholdMeters = 150) {
  const distKM = getDistanceKM(agentLat, agentLng, dropLat, dropLng);
  return (distKM * 1000) <= thresholdMeters;
}

module.exports = {
  getDistanceKM,
  detectZone,
  verifyGeofence
};
