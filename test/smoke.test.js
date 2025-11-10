/**
 * Smoke tests for gauss-kruger package
 * 
 * Basic functionality tests to ensure the package works correctly
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import {
  GaussKrugerProjection,
  projectMGA2020,
  inverseMGA2020,
  mga2020ZoneFromLongitude,
} from '../dist/index.js';

function approxEqual(a, b, tolerance = 1e-10) {
  return Math.abs(a - b) < tolerance;
}

test('Basic projection round-trip', () => {
  const proj = new GaussKrugerProjection();
  const originalLat = -33.8688;
  const originalLon = 151.2093;

  const { easting, northing } = proj.geodeticToGrid(originalLat, originalLon);
  const { latitude, longitude } = proj.gridToGeodetic(northing, easting);

  assert(approxEqual(latitude, originalLat, 1e-10), 'Latitude round-trip failed');
  assert(approxEqual(longitude, originalLon, 1e-10), 'Longitude round-trip failed');
});

test('MGA2020 projection', () => {
  const sydneyResult = projectMGA2020(-33.8688, 151.2093);
  assert.strictEqual(sydneyResult.zone, 56, 'Sydney should be in zone 56');
  assert(approxEqual(sydneyResult.easting, 334368.63, 1), 'Sydney easting check');
  assert(approxEqual(sydneyResult.northing, 6250948.35, 1), 'Sydney northing check');
});

test('MGA2020 inverse projection', () => {
  const sydneyResult = projectMGA2020(-33.8688, 151.2093);
  const inverseResult = inverseMGA2020(sydneyResult.zone, sydneyResult.easting, sydneyResult.northing);
  assert(approxEqual(inverseResult.latitude, -33.8688, 1e-6), 'MGA2020 inverse latitude failed');
  assert(approxEqual(inverseResult.longitude, 151.2093, 1e-6), 'MGA2020 inverse longitude failed');
});

test('Zone detection', () => {
  const testZones = [
    { lon: 111, expected: 49 },
    { lon: 117, expected: 50 },
    { lon: 123, expected: 51 },
    { lon: 129, expected: 52 },
    { lon: 135, expected: 53 },
    { lon: 141, expected: 54 },
    { lon: 147, expected: 55 },
    { lon: 160, expected: 56 }, // clamp above last zone
  ];

  for (const { lon, expected } of testZones) {
    const zone = mga2020ZoneFromLongitude(lon);
    assert.strictEqual(zone, expected, `Longitude ${lon} should be zone ${expected}, got ${zone}`);
  }
});

test('Custom projection parameters', () => {
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
});

test('Error handling', () => {
  assert.throws(() => {
    new GaussKrugerProjection({ equatorialRadius: -1 });
  }, /equatorialRadius must be > 0/);

  assert.throws(() => {
    new GaussKrugerProjection({ flattening: 0.1 });
  }, /flattening must be in \(0, 0.01\)/);
});

test('Performance sanity check', () => {
  const proj = new GaussKrugerProjection();
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
  console.log(`Performance: ${avgTime.toFixed(4)}ms per projection (forward+inverse)`);
  
  // Should be reasonably fast (less than 1ms per projection)
  assert(avgTime < 1, 'Performance should be under 1ms per projection');
});

test('Edge cases', () => {
  const edgeCases = [
    { lat: 0, lon: 0, desc: 'Equator at Greenwich', centralMeridian: 0 },
    { lat: 89.9, lon: 0, desc: 'Near North Pole', centralMeridian: 0 },
    { lat: -89.9, lon: 0, desc: 'Near South Pole', centralMeridian: 0 },
    { lat: 0, lon: 179.9, desc: 'Near International Date Line', centralMeridian: 177 },
    { lat: 0, lon: -179.9, desc: 'Near International Date Line (west)', centralMeridian: -177 },
  ];

  edgeCases.forEach(({ lat, lon, desc, centralMeridian }) => {
    const proj = new GaussKrugerProjection({ centralMeridian });
    const grid = proj.geodeticToGrid(lat, lon);
    const back = proj.gridToGeodetic(grid.northing, grid.easting);
    assert(approxEqual(back.latitude, lat, 1e-6), `${desc} latitude round-trip failed`);
    assert(approxEqual(back.longitude, lon, 1e-6), `${desc} longitude round-trip failed`);
  });
});

console.log('🎉 All smoke tests passed!');
