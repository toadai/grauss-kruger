/**
 * UTM (Universal Transverse Mercator) Example
 * 
 * This example demonstrates how to create custom UTM projections
 * using the GaussKrugerProjection class with standard UTM parameters.
 */

import { GaussKrugerProjection, type GaussKrugerProjectionOptions } from '../dist/index.js';

// Standard UTM parameters
const UTM_DEFAULTS: GaussKrugerProjectionOptions = {
  equatorialRadius: 6378137.0, // WGS84
  flattening: 1 / 298.257223563, // WGS84
  latitudeOfOrigin: 0,
  scale: 0.9996,
  falseEasting: 500000,
  falseNorthing: 0 // Northern hemisphere
};

// Southern hemisphere UTM parameters
const UTM_SOUTHERN: GaussKrugerProjectionOptions = {
  ...UTM_DEFAULTS,
  falseNorthing: 10000000 // 10,000,000m
};

/**
 * Create a UTM projection for a specific zone and hemisphere
 */
function createUTM(zone: number, southern: boolean = false): GaussKrugerProjection {
  const centralMeridian = (zone - 1) * 6 - 180 + 3; // Zone center: 6° * zone - 183
  return new GaussKrugerProjection({
    ...(southern ? UTM_SOUTHERN : UTM_DEFAULTS),
    centralMeridian
  });
}

// Test locations around the world
const locations = [
  { name: 'New York', lat: 40.7128, lon: -74.0060, zone: 18, southern: false },
  { name: 'London', lat: 51.5074, lon: -0.1278, zone: 30, southern: false },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, zone: 54, southern: false },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, zone: 56, southern: true },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333, zone: 23, southern: true },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, zone: 36, southern: false },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, zone: 43, southern: false },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241, zone: 34, southern: true }
];

console.log('=== UTM Projection Examples ===\n');

locations.forEach(location => {
  const proj = createUTM(location.zone, location.southern);
  const { easting, northing } = proj.geodeticToGrid(location.lat, location.lon);
  
  console.log(`${location.name} (Zone ${location.zone}${location.southern ? 'S' : 'N'}):`);
  console.log(`  Geographic: ${location.lat.toFixed(4)}°, ${location.lon.toFixed(4)}°`);
  console.log(`  UTM: E=${easting.toFixed(2)}m, N=${northing.toFixed(2)}m`);
  
  // Test round-trip accuracy
  const back = proj.gridToGeodetic(northing, easting);
  const latDiff = Math.abs(back.latitude - location.lat);
  const lonDiff = Math.abs(back.longitude - location.lon);
  console.log(`  Round-trip error: ${latDiff.toExponential(2)}°, ${lonDiff.toExponential(2)}°`);
  console.log('');
});

// Demonstrate UTM zone calculation
console.log('=== UTM Zone Calculation ===');
function getUTMZone(longitude: number): number {
  return Math.min(60, Math.max(1, Math.floor((longitude + 180) / 6) + 1));
}

const testLongitudes = [-180, -120, -60, 0, 60, 120, 180];
testLongitudes.forEach(lon => {
  const zone = getUTMZone(lon);
  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  console.log(`Longitude ${lon}° → UTM Zone ${zone} (Central meridian: ${centralMeridian}°)`);
});

// Custom projection example (non-standard parameters)
console.log('\n=== Custom Projection Example ===');
const customProj = new GaussKrugerProjection({
  equatorialRadius: 6378206.4, // Clarke 1866
  flattening: 1 / 294.9786982,
  centralMeridian: -75,
  latitudeOfOrigin: 40,
  scale: 0.9999,
  falseEasting: 600000,
  falseNorthing: 0
});

const customPoint = customProj.geodeticToGrid(40.0, -75.0);
console.log('Custom projection (Clarke 1866 ellipsoid):');
console.log(`  Point (40°, -75°): E=${customPoint.easting.toFixed(2)}m, N=${customPoint.northing.toFixed(2)}m`);

// Performance test
console.log('\n=== Performance Test ===');
const testProj = createUTM(53);
const iterations = 10000;
const startTime = performance.now();

for (let i = 0; i < iterations; i++) {
  const lat = 35 + Math.random() * 10;
  const lon = 130 + Math.random() * 10;
  const grid = testProj.geodeticToGrid(lat, lon);
  testProj.gridToGeodetic(grid.northing, grid.easting);
}

const endTime = performance.now();
const timePerProjection = (endTime - startTime) / (iterations * 2);
console.log(`Performance: ${timePerProjection.toFixed(4)}ms per projection (forward+inverse)`);
console.log(`Total time for ${iterations * 2} projections: ${(endTime - startTime).toFixed(2)}ms`);