const test = require('node:test');
const assert = require('node:assert');

// Import services from consolidated server
const { getDistanceKM, verifyGeofence, calculateVolumetricWeight, optimizeRoute, calculateOrderCharge, detectZone, initDB } = require('../server');

test('Database Setup Initialization', async () => {
  await initDB();
  assert.ok(true, 'Database schemas should initialize correctly');
});

test('Pricing Engine - Core SLA Rate Card Calculation', async () => {
  // Mock order details
  const details = {
    pickup_lat: 40.7589, pickup_lng: -73.9851, // inside Manhattan Core
    drop_lat: 40.7589, drop_lng: -73.9851,     // inside Manhattan Core (Intra-Zone)
    dimensions: '30x20x15',                    // 1.8kg volumetric weight
    actual_weight: 1.0,                        // base weight limit is 2.0kg for B2C
    order_type: 'B2C',
    payment_type: 'Prepaid',
    weather: 'Sunny',
    traffic: 'Light'
  };

  const pricing = await calculateOrderCharge(details);
  
  // Base B2C rate is $15.00. Since actual & volumetric weight (1.8kg) is less than base limit (2.0kg),
  // no incremental weight charge applies. Total charge should be exactly base rate ($15.00).
  assert.strictEqual(pricing.total_charge, 15.00);
});

test('Geospatial Math - Distance Calculations', () => {
  // Distance from Times Square to Central Park (approx 2.0 - 2.5 km)
  const dist = getDistanceKM(40.7580, -73.9855, 40.7851, -73.9682);
  assert.ok(dist > 2.0 && dist < 3.5, `Distance calculated was: ${dist}km`);
});

test('Geofencing Verification Guards', () => {
  // Very close coordinates (under 150m)
  const close = verifyGeofence(40.7580, -73.9855, 40.7581, -73.9856, 150);
  assert.strictEqual(close, true, 'Should be within geofence range');

  // Far coordinates (over 1.5km)
  const far = verifyGeofence(40.7580, -73.9855, 40.7700, -73.9900, 150);
  assert.strictEqual(far, false, 'Should be outside geofence range');
});

test('Pricing Engine - Volumetric Weight Calculation', () => {
  // Sizing: 30x20x15 / 5000 = 1.8 kg
  const volWeight = calculateVolumetricWeight('30x20x15');
  assert.strictEqual(volWeight, 1.8);

  // Invalid sizes handle gracefully
  const invalid = calculateVolumetricWeight('invalid-size');
  assert.strictEqual(invalid, 0);
});

test('Routing Solver - Nearest Neighbor with 2-Opt Optimization', () => {
  const startPoint = { lat: 40.7128, lng: -74.0060, label: 'Start' };
  
  // Arrange stops in a scattered pattern
  const stops = [
    { id: 1, lat: 40.7580, lng: -73.9855, label: 'Midtown' },
    { id: 2, lat: 40.7484, lng: -73.9857, label: 'Empire State' },
    { id: 3, lat: 40.7061, lng: -73.9969, label: 'Brooklyn Bridge' }
  ];

  const result = optimizeRoute(startPoint, stops);
  
  // Verify it returned all stops + starting point
  assert.strictEqual(result.path.length, 4);
  assert.ok(result.totalDistanceKM > 0);
  assert.strictEqual(result.path[0].label, 'Start (Agent)');
});

test('Geospatial Zone Detection - Closest Center Match', async () => {
  // Test detection of overlapping circular zones
  // We assume default Manhattan Core is center (40.7589, -73.9851)
  // Let's check a point directly inside it
  const zone = await detectZone(40.7589, -73.9851);
  assert.ok(zone !== null);
  assert.strictEqual(zone.name, 'Manhattan Core');
});

test('Pricing Engine - Volumetric vs Actual Weight Choice', async () => {
  // Sizing 50x40x30 / 5000 = 12.0kg volumetric weight
  // Actual weight 5.0kg -> Billing weight should be 12.0kg
  const details = {
    pickup_lat: 40.7589, pickup_lng: -73.9851,
    drop_lat: 40.7589, drop_lng: -73.9851,
    dimensions: '50x40x30',
    actual_weight: 5.0,
    order_type: 'B2C',
    payment_type: 'Prepaid'
  };
  const pricing = await calculateOrderCharge(details);
  assert.strictEqual(pricing.billing_weight, 12.0);
});
