const { all, get } = require('../config/db');
const { getDistanceKM } = require('./geoService');

async function autoAssignAgent(order, excludeAgentId = null) {
  const { pickup_lat, pickup_lng } = order;
  let query = "SELECT id, username, current_lat, current_lng, rating, points FROM users WHERE role = 'agent' AND status = 'active'";
  const params = [];
  if (excludeAgentId) {
    query += " AND id != ?";
    params.push(excludeAgentId);
  }
  const agents = await all(query, params);
  
  if (agents.length === 0) return null;

  let bestAgent = null;
  let lowestScore = Infinity;

  for (const agent of agents) {
    if (agent.current_lat === null || agent.current_lng === null) continue;

    // Check active jobs count to enforce dynamic occupancy limits
    const activeLoad = await get("SELECT COUNT(*) as count FROM orders WHERE agent_id = ? AND status NOT IN ('Delivered', 'Failed')", [agent.id]);
    if (activeLoad && activeLoad.count >= 3) {
      continue; // Skip riders at max capacity
    }

    const distKM = getDistanceKM(agent.current_lat, agent.current_lng, pickup_lat, pickup_lng);
    if (distKM > 25.0) continue; // max radius guard

    const ratingFactor = 1.3 - (agent.rating / 5.0); 
    const score = distKM * ratingFactor;

    if (score < lowestScore) {
      lowestScore = score;
      bestAgent = agent;
    }
  }
  return bestAgent;
}

module.exports = {
  autoAssignAgent
};
