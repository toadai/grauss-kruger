import { GaussKrugerProjection } from './grauss-kruger.js';

/** MGA2020 zones used on the Australian mainland and near‑offshore. */
export type MGA2020Zone = 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56;

/** GRS80 ellipsoid parameters used by GDA2020 / MGA2020. */
const GRS80 = {
  a: 6378137.0, // semi-major axis [m]
  invF: 298.257222101, // inverse flattening
};

/**
 * Compute the central meridian (degrees) for an MGA2020 integer zone in [49..56].
 * UTM rule: λ₀ = 6·zone − 183.
 * (e.g., z=49→111°, 50→117°, …, 56→153°)
 */
export const mga2020CentralMeridian = (zone: number): number => {
  if (!Number.isInteger(zone) || zone < 49 || zone > 56) {
    throw new Error("MGA2020 zone must be an integer in [49, 56]");
  }
  return zone * 6 - 183;
};

/**
 * Determine the MGA2020 zone for a longitude (degrees).
 * Returns a value in [49..56] clamped to the Australian zones.
 *
 * GA defines MGA2020 as UTM over GDA2020 with the usual 6° zone width,
 * scale 0.9996, FE=500000 m, and FN=10,000,000 m in the southern hemisphere:
 * https://www.ga.gov.au/scientific-topics/positioning-navigation/geodesy/datums-projections
 */
export function mga2020ZoneFromLongitude(longitudeDeg: number): MGA2020Zone {
  if (!Number.isFinite(longitudeDeg)) {
    throw new Error("longitude must be a finite number");
  }
  const utmZone = Math.floor((longitudeDeg + 180) / 6) + 1; // standard UTM zoning
  const z = Math.min(56, Math.max(49, utmZone)); // clamp to AU zones
  return z as MGA2020Zone;
}

/**
 * Create a Gauss–Krüger projection configured for MGA2020 in the given zone.
 *
 * Parameters are sourced from EPSG’s “GDA2020 / MGA zone XX” records:
 *  - Ellipsoid: GRS80 (a=6378137, 1/f=298.257222101)
 *  - Latitude of origin: 0°
 *  - Central meridian: 6·zone − 183 (deg)
 *  - k0: 0.9996
 *  - False Easting: 500000 m
 *  - False Northing: 10000000 m (southern hemisphere)
 * See GDA2020 / MGA zone 56 (EPSG:7856): https://epsg.io/7856
 */
export function createMGA2020(zone: MGA2020Zone): GaussKrugerProjection {
  const f = 1 / GRS80.invF;
  return new GaussKrugerProjection({
    equatorialRadius: GRS80.a,
    flattening: f,
    centralMeridian: mga2020CentralMeridian(zone),
    scale: 0.9996,
    falseEasting: 500000,
    falseNorthing: 10000000,
  });
}

/**
 * Convenience: project a geographic coordinate in Australia with the correct MGA2020 zone.
 * Returns (zone, easting, northing).
 *
 * Uses the same fourth-order Krüger series as GaussKrugerProjection.
 */
export function projectMGA2020(
  latitudeDeg: number,
  longitudeDeg: number
): {
  zone: MGA2020Zone;
  easting: number;
  northing: number;
} {
  const zone = mga2020ZoneFromLongitude(longitudeDeg);
  const proj = createMGA2020(zone);
  const { easting, northing } = proj.geodeticToGrid(latitudeDeg, longitudeDeg);
  return { zone, easting, northing };
}

/**
 * Convenience: invert an MGA2020 grid coordinate for a specific zone.
 * Returns (latitude, longitude) in degrees.
 */
export function inverseMGA2020(
  zone: MGA2020Zone,
  easting: number,
  northing: number
): {
  latitude: number;
  longitude: number;
} {
  const proj = createMGA2020(zone);
  return proj.gridToGeodetic(northing, easting);
}
