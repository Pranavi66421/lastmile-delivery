const { getDistanceKM } = require('./geoService');

function calculatePathDistance(path) {
  let distance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    distance += getDistanceKM(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  return distance;
}

function optimizeRoute(startPoint, stops) {
  if (stops.length === 0) return { path: [startPoint], totalDistanceKM: 0 };

  const unvisited = [...stops];
  const path = [{ ...startPoint, label: 'Start (Agent)' }];
  let current = startPoint;

  // Nearest-Neighbor construction
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = getDistanceKM(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    current = unvisited[nearestIndex];
    path.push(current);
    unvisited.splice(nearestIndex, 1);
  }

  // 2-Opt refinement loop
  let improved = true;
  let bestDistance = calculatePathDistance(path);

  while (improved) {
    improved = false;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const newPath = [
          ...path.slice(0, i),
          ...path.slice(i, j + 1).reverse(),
          ...path.slice(j + 1)
        ];
        const newDistance = calculatePathDistance(newPath);
        if (newDistance < bestDistance - 0.001) {
          bestDistance = newDistance;
          for (let k = 0; k < path.length; k++) path[k] = newPath[k];
          improved = true;
        }
      }
    }
  }

  return { path, totalDistanceKM: Number(bestDistance.toFixed(2)) };
}

module.exports = {
  optimizeRoute,
  calculatePathDistance
};
