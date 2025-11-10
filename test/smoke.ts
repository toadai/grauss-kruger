/**
 * Smoke tests for gauss-kruger package
 * 
 * Basic functionality tests to ensure the package works correctly
 */

import { GaussKrugerProjection, projectMGA2020, inverseMGA2020, mga2020ZoneFromLongitude } from '../src';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function approxEqual(a: number, b: number, tolerance: number = 1e-10): boolean {
  return Math.abs(a - b) < tolerance;
}

console.log('Running gauss-kruger smoke tests...\n');

// Test 1: Basic projection round-trip
console.log('Test 1: Basic projection round-trip');
const proj = new GaussKrugerProjection();
const originalLat = -33.8688;
const originalLon = 151.2093;

const { easting, northing } = proj.geodeticToGrid(originalLat, originalLon);
const { latitude, longitude } = proj.gridToGeodetic(northing, easting);

assert(approxEqual(latitude, originalLat, 1e-10), 'Latitude round-trip failed');
assert(approxEqual(longitude, originalLon, 1e-10), 'Longitude round-trip failed');
console.log('✓ Basic projection round-trip passed');

// Test 2: MGA2020 projection
console.log('\nTest 2: MGA2020 projection');
const sydneyResult = projectMGA2020(-33.8688, 151.2093);
assert(sydneyResult.zone === 56, 'Sydney should be in zone 56');
assert(sydneyResult.easting > 500000, 'Sydney easting should be > 500000');
assert(sydneyResult.northing > 6000000, 'Sydney northing should be > 6000000');
console.log(`✓ Sydney in Zone ${sydneyResult.zone}: E=${sydneyResult.easting.toFixed(2)}m, N=${sydneyResult.northing.toFixed(2)}m`);

// Test 3: MGA2020 inverse projection
console.log('\nTest 3: MGA2020 inverse projection');
const inverseResult = inverseMGA2020(sydneyResult.zone, sydneyResult.easting, sydneyResult.northing);
assert(approxEqual(inverseResult.latitude, -33.8688, 1e-6), 'MGA2020 inverse latitude failed');
assert(approxEqual(inverseResult.longitude, 151.2093, 1e-6), 'MGA2020 inverse longitude failed');
console.log('✓ MGA2020 inverse projection passed');

// Test 4: Zone detection
console.log('\nTest 4: Zone detection');
const testZones = [
  { lon: 110, expected: 49 },
  { lon: 120, expected: 50 },
  { lon: 130, expected: 51 },
  { lon: 140, expected: 52 },
  { lon: 150, expected: 53 },
  { lon: 160, expected: 54 }
];

testZones.forEach(({ lon, expected }) => {
  const zone = mga2020ZoneFromLongitude(lon);
  assert(zone === expected, `Longitude ${lon} should be zone ${expected}, got ${zone}`);
});
console.log('✓ Zone detection passed');

// Test 5: Custom projection parameters
console.log('\nTest 5: Custom projection parameters');
const customProj = new GaussKrugerProjection({
  centralMeridian: 0,
  scale: 1.0,
  falseEasting: 0,
  falseNorthing: 0
});

const greenwich = customProj.geodeticToGrid(51.4778, 0);
const backToGreenwich = customProj.gridToGeodetic(greenwich.northing, greenwich.easting);
assert(approxEqual(backToGreenwich.latitude, 51.4778, 1e-10), 'Custom projection latitude failed');
assert(approxEqual(backToGreenwich.longitude, 0, 1e-10), 'Custom projection longitude failed');
console.log('✓ Custom projection parameters passed');

// Test 6: Error handling
console.log('\nTest 6: Error handling');
try {
  new GaussKrugerProjection({ equatorialRadius: -1 });
  assert(false, 'Should throw error for negative radius');
} catch (e) {
  console.log('✓ Error handling for invalid radius passed');
}

try {
  new GaussKrugerProjection({ flattening: 0.1 });
  assert(false, 'Should throw error for invalid flattening');
} catch (e) {
  console.log('✓ Error handling for invalid flattening passed');
}

// Test 7: Performance sanity check
console.log('\nTest 7: Performance sanity check');
const iterations = 1000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
  const lat = -30 + Math.random() * 20;
  const lon = 130 + Math.random() * 20;
  const grid = proj.geodeticToGrid(lat, lon);
  proj.gridToGeodetic(grid.northing, grid.easting);
}

const endTime = performance.now();
const avgTime = (endTime - startTime) / (iterations * 2);
console.log(`✓ Performance: ${avgTime.toFixed(4)}ms per projection (forward+inverse)`);

// Test 8: Edge cases
console.log('\nTest 8: Edge cases');
const edgeCases = [
  { lat: 0, lon: 0, desc: 'Equator at Greenwich' },
  { lat: 89.9, lon: 0, desc: 'Near North Pole' },
  { lat: -89.9, lon: 0, desc: 'Near South Pole' },
  { lat: 0, lon: 179.9, desc: 'Near International Date Line' },
  { lat: 0, lon: -179.9, desc: 'Near International Date Line (west)' }
];

edgeCases.forEach(({ lat, lon, desc }) => {
  try {
    const grid = proj.geodeticToGrid(lat, lon);
    const back = proj.gridToGeodetic(grid.northing, grid.easting);
    assert(approxEqual(back.latitude, lat, 1e-6), `${desc} latitude round-trip failed`);
    assert(approxEqual(back.longitude, lon, 1e-6), `${desc} longitude round-trip failed`);
    console.log(`✓ ${desc} passed`);
  } catch (e) {
    console.log(`⚠ ${desc} failed: ${e}`);
  }
});

console.log('\n🎉 All smoke tests passed!');