/**
 * Smoke tests for gauss-kruger package (node:test)
 * Validates core behavior with realistic tolerances and correct zone logic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  GaussKrugerProjection,
  projectMGA2020,
  inverseMGA2020,
  mga2020ZoneFromLongitude,
  createMGA2020,
} from "../dist/index.js";

// Helpers
const approxEqual = (a: number, b: number, tol = 1e-8) =>
  Math.abs(a - b) <= tol;
const approxEqualMeters = (a: number, b: number, tolMeters = 1) =>
  Math.abs(a - b) <= tolMeters;

/**
 * 1) Basic projection round-trip (use correct zone for the point)
 */
test("Basic projection round-trip (MGA2020 Zone 56, Sydney)", () => {
  const lat = -33.8688;
  const lon = 151.2093; // Sydney ~ Zone 56

  const proj = createMGA2020(56);
  const { easting, northing } = proj.geodeticToGrid(lat, lon);
  const { latitude, longitude } = proj.gridToGeodetic(northing, easting);

  assert.ok(approxEqual(latitude, lat, 1e-8), "Latitude round-trip failed");
  assert.ok(approxEqual(longitude, lon, 1e-8), "Longitude round-trip failed");
});

/**
 * 2) MGA2020 projection numeric spot-check (Sydney)
 *    Known-good values are within ~1 m when using GRS80 & UTM k0=0.9996.
 */
test("MGA2020 projection (Sydney spot-check)", () => {
  const res = projectMGA2020(-33.8688, 151.2093);
  assert.equal(res.zone, 56, "Sydney should be in zone 56");

  // Expect easting < 500k (west of CM=153°), and near known values:
  assert.ok(res.easting < 500000, "Sydney easting should be < 500000");
  assert.ok(
    approxEqualMeters(res.easting, 334368.63, 1.0),
    "Easting ~334368.63 ±1 m",
  );
  assert.ok(
    approxEqualMeters(res.northing, 6250948.35, 1.0),
    "Northing ~6250948.35 ±1 m",
  );
});

/**
 * 3) MGA2020 inverse projection
 */
test("MGA2020 inverse projection", () => {
  const fwd = projectMGA2020(-33.8688, 151.2093);
  const inv = inverseMGA2020(fwd.zone, fwd.easting, fwd.northing);

  assert.ok(
    approxEqual(inv.latitude, -33.8688, 1e-7),
    "Inverse latitude failed",
  );
  assert.ok(
    approxEqual(inv.longitude, 151.2093, 1e-7),
    "Inverse longitude failed",
  );
});

/**
 * 4) Zone detection (UTM rule, then clamped to [49..56] for MGA2020 helper)
 */
test("MGA2020 zone detection", () => {
  const cases = [
    { lon: 111, expected: 49 },
    { lon: 117, expected: 50 },
    { lon: 123, expected: 51 },
    { lon: 129, expected: 52 },
    { lon: 135, expected: 53 },
    { lon: 141, expected: 54 },
    { lon: 147, expected: 55 },
    { lon: 150, expected: 56 }, // boundary falls to higher-numbered zone
    { lon: 160, expected: 56 }, // clamped to AU range
  ];

  for (const { lon, expected } of cases) {
    const zone = mga2020ZoneFromLongitude(lon);
    assert.equal(
      zone,
      expected,
      `Longitude ${lon} → zone ${expected}, got ${zone}`,
    );
  }
});

/**
 * 5) Custom projection parameters (near Greenwich)
 */
test("Custom projection parameters (Greenwich round-trip)", () => {
  const proj = new GaussKrugerProjection({
    centralMeridian: 0,
    scale: 1.0,
    falseEasting: 0,
    falseNorthing: 0,
  });

  const fwd = proj.geodeticToGrid(51.4778, 0); // Greenwich Observatory
  const inv = proj.gridToGeodetic(fwd.northing, fwd.easting);

  assert.ok(approxEqual(inv.latitude, 51.4778, 1e-8), "Latitude mismatch");
  assert.ok(approxEqual(inv.longitude, 0, 1e-8), "Longitude mismatch");
});

/**
 * 6) Error handling
 */
test("Error handling", () => {
  assert.throws(
    () => new GaussKrugerProjection({ equatorialRadius: -1 }),
    /equatorialRadius must be > 0/,
  );
  assert.throws(
    () => new GaussKrugerProjection({ flattening: 0.1 }),
    /flattening must be in \(0, 0.01\)/,
  );
});

/**
 * 7) Performance sanity (report and assert gently)
 *    Measures per *pair* (forward + inverse). Uses correct zones for samples.
 */
test("Performance sanity check", () => {
  const iterations = 1000;
  const zoneCache = new Map<number, GaussKrugerProjection>();

  const getProj = (lon: number) => {
    const z = mga2020ZoneFromLongitude(lon);
    let p = zoneCache.get(z);
    if (!p) {
      p = createMGA2020(z);
      zoneCache.set(z, p);
    }
    return p;
  };

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    const lat = -44 + Math.random() * 16; // AU-ish band
    const lon = 112 + Math.random() * 42; // AU-ish longitudes
    const proj = getProj(lon);
    const grid = proj.geodeticToGrid(lat, lon);
    proj.gridToGeodetic(grid.northing, grid.easting);
  }
  const ms = performance.now() - t0;
  const perPairMs = ms / iterations;

  // Aim for < 1 ms/pair on a typical dev machine; don't make CI flaky.
  assert.ok(
    perPairMs < 2.0,
    `Too slow: ${perPairMs.toFixed(3)} ms per forward+inverse`,
  );
});

/**
 * 8) Edge cases (well-conditioned Δλ)
 */
test("Edge cases near poles and date line (well-conditioned)", () => {
  const cases = [
    { lat: 0, lon: 0, cm: 0, desc: "Equator at Greenwich" },
    { lat: 89.9, lon: 0, cm: 0, desc: "Near North Pole" },
    { lat: -89.9, lon: 0, cm: 0, desc: "Near South Pole" },
    { lat: 0, lon: 179.9, cm: 177, desc: "Near International Date Line" },
    {
      lat: 0,
      lon: -179.9,
      cm: -177,
      desc: "Near International Date Line (west)",
    },
  ];

  for (const { lat, lon, cm, desc } of cases) {
    const proj = new GaussKrugerProjection({ centralMeridian: cm });
    const g = proj.geodeticToGrid(lat, lon);
    const back = proj.gridToGeodetic(g.northing, g.easting);
    assert.ok(
      approxEqual(back.latitude, lat, 1e-6),
      `${desc}: latitude round-trip`,
    );
    assert.ok(
      approxEqual(back.longitude, lon, 1e-6),
      `${desc}: longitude round-trip`,
    );
  }
});
