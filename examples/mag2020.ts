/**
 * MGA2020 (Australian Map Grid 2020) Example
 * 
 * This example demonstrates how to use the MGA2020 functions
 * to project and inverse-project coordinates in Australia.
 */

import {
  projectMGA2020,
  inverseMGA2020,
  mga2020ZoneFromLongitude,
  createMGA2020,
  type MGA2020Zone
} from '../src';

// Major Australian cities coordinates
const cities = [
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
  { name: 'Brisbane', lat: -27.4698, lon: 153.0251 },
  { name: 'Perth', lat: -31.9505, lon: 115.8605 },
  { name: 'Adelaide', lat: -34.9285, lon: 138.6007 },
  { name: 'Darwin', lat: -12.4634, lon: 130.8456 },
  { name: 'Hobart', lat: -42.8821, lon: 147.3271 },
  { name: 'Canberra', lat: -35.2809, lon: 149.1300 }
];

console.log('=== MGA2020 Projection Examples ===\n');

// Project all cities to MGA2020
cities.forEach(city => {
  const { zone, easting, northing } = projectMGA2020(city.lat, city.lon);
  console.log(`${city.name}:`);
  console.log(`  Geographic: ${city.lat.toFixed(4)}°, ${city.lon.toFixed(4)}°`);
  console.log(`  MGA2020 Zone ${zone}: E=${easting.toFixed(2)}m, N=${northing.toFixed(2)}m`);
  
  // Test round-trip accuracy
  const back = inverseMGA2020(zone, easting, northing);
  const latDiff = Math.abs(back.latitude - city.lat);
  const lonDiff = Math.abs(back.longitude - city.lon);
  console.log(`  Round-trip error: ${latDiff.toExponential(2)}°, ${lonDiff.toExponential(2)}°`);
  console.log('');
});

// Demonstrate zone detection
console.log('=== Zone Detection ===');
const testLongitudes = [110, 115, 120, 125, 130, 135, 140, 145, 150];
testLongitudes.forEach(lon => {
  const zone = mga2020ZoneFromLongitude(lon);
  const centralMeridian = zone * 6 - 183;
  console.log(`Longitude ${lon}° → Zone ${zone} (Central meridian: ${centralMeridian}°)`);
});

// Custom MGA2020 projection for specific zone
console.log('\n=== Custom Zone Projection ===');
const zone56 = createMGA2020(56 as MGA2020Zone);
const sydneyCoords = zone56.geodeticToGrid(-33.8688, 151.2093);
console.log(`Sydney in Zone 56: E=${sydneyCoords.easting.toFixed(2)}m, N=${sydneyCoords.northing.toFixed(2)}m`);

// Edge case: zone boundary
console.log('\n=== Zone Boundary Test ===');
const boundaryLon = 132.0; // Near zone 52/53 boundary
const boundaryLat = -23.0;
const boundaryResult = projectMGA2020(boundaryLat, boundaryLon);
console.log(`Boundary point (${boundaryLat}°, ${boundaryLon}°):`);
console.log(`  Assigned to Zone ${boundaryResult.zone}`);
console.log(`  E=${boundaryResult.easting.toFixed(2)}m, N=${boundaryResult.northing.toFixed(2)}m`);