// gauss-kruger.ts
// Version: 1.1.0
// Robust Gauss–Krüger (Transverse Mercator) forward/inverse projection (JHS/EPSG formulation).
// - All input/output angles are DEGREES.
// - All linear units are METERS.
// References:
// * IOGP / EPSG Guidance Note 7-2, method 9807 (JHS formulas):
//   https://epsg.org/guidance-notes.html
// * Karney, “Transverse Mercator with an accuracy of a few nanometers” (2011):
//   https://doi.org/10.1007/s00190-011-0445-3
//
// Defaults match WGS 84 / UTM-style parameters for a Zone 33N-like setup:
//   a = 6378137.0 m, f = 1/298.257223563, λ0 = 15°, k0 = 0.9996, FE = 500000 m, FN = 0 m, φ0 = 0°.

export interface GaussKrugerProjectionOptions {
  /** Semi-major axis (equatorial radius) in meters. Default: WGS84 a = 6378137.0 */
  equatorialRadius?: number;
  /** Ellipsoid flattening f. Default: WGS84 f = 1/298.257223563 */
  flattening?: number;
  /** Central meridian in degrees (λ₀). Default: 15 (UTM zone 33). */
  centralMeridian?: number;
  /** Latitude of origin in degrees (φ₀). Default: 0 (equator, like UTM). */
  latitudeOfOrigin?: number;
  /** Scale factor at central meridian (k₀). Default: 0.9996 (UTM). */
  scale?: number;
  /** False easting (meters). Default: 500000 (UTM). */
  falseEasting?: number;
  /** False northing (meters). Default: 0 in N hemisphere (UTM North). */
  falseNorthing?: number;
}

type ForwardResult = { northing: number; easting: number };
type InverseResult = { latitude: number; longitude: number };

/** Degrees → radians. */
const toRad = (deg: number): number => (deg * Math.PI) / 180;
/** Radians → degrees. */
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Clamp to [-1 + ε, 1 − ε] for functions like asin/atanh. */
const clampUnit = (x: number): number => {
  // 1 - 2e-16 keeps us within double safe range while avoiding boundary overflow in atanh.
  const LIM = 1 - 2e-16;
  return x > LIM ? LIM : x < -LIM ? -LIM : x;
};

const sinh = (x: number) => Math.sinh(x);
const cosh = (x: number) => Math.cosh(x);
const tanh = (x: number) => Math.tanh(x);
const asinh = (x: number) => Math.asinh(x);
const atanh = (x: number) => Math.atanh(clampUnit(x)); // safe atanh

const p2 = (x: number) => x * x;
const p3 = (x: number) => x * x * x;
const p4 = (x: number) => x * x * x * x;

/**
 * Gauss–Krüger (Transverse Mercator) projection using the EPSG JHS formulation:
 * - “Conformal sphere” path for forward and reverse, with stable tangent recovery.
 * - Krüger α- and β-series in third flattening n to 4th order.
 * - Rectifying constant B = a/(1+n)*(1 + n²/4 + n⁴/64).
 *
 * Notes on domain & stability:
 * - The JHS approach is robust to ~±40° longitude from λ₀; UTM usage is ±3°.
 * - atanh arguments are clamped inside |x|=1 to avoid boundary overflow.
 */
export class GaussKrugerProjection {
  readonly equatorialRadius: number; // a
  readonly flattening: number; // f
  readonly centralMeridian: number; // λ₀ (deg)
  readonly latitudeOfOrigin: number; // φ₀ (deg)
  readonly scale: number; // k₀
  readonly falseEasting: number; // FE
  readonly falseNorthing: number; // FN

  // Derived constants (immutable)
  private readonly e2: number; // first eccentricity squared, e² = f(2-f)
  private readonly e: number; // first eccentricity, e = sqrt(e²)
  private readonly n: number; // third flattening, n = f/(2-f)
  private readonly B: number; // rectifying radius-like constant
  private readonly alpha: [number, number, number, number]; // α₁..α₄ (forward)
  private readonly beta: [number, number, number, number]; // β₁..β₄ (inverse)
  private readonly M0: number; // meridional arc at latitude of origin (meters)

  constructor(opts: GaussKrugerProjectionOptions = {}) {
    // Defaults (WGS84 / UTM-like)
    this.equatorialRadius = opts.equatorialRadius ?? 6378137.0;
    this.flattening = opts.flattening ?? 1 / 298.257223563;
    this.centralMeridian = opts.centralMeridian ?? 15;
    this.latitudeOfOrigin = opts.latitudeOfOrigin ?? 0;
    this.scale = opts.scale ?? 0.9996;
    this.falseEasting = opts.falseEasting ?? 500000;
    this.falseNorthing = opts.falseNorthing ?? 0;

    this.#validateInput();

    // Ellipsoid + series constants
    this.e2 = this.flattening * (2 - this.flattening);
    this.e = Math.sqrt(this.e2);
    this.n = this.flattening / (2 - this.flattening);

    // Rectifying constant per EPSG JHS: B = a/(1+n)*(1 + n²/4 + n⁴/64)
    const n = this.n;
    this.B =
      (this.equatorialRadius / (1 + n)) * (1 + 0.25 * p2(n) + (1 / 64) * p4(n));

    // α (forward) and β (inverse) coefficients, truncated to n⁴.
    this.alpha = [
      0.5 * n - (2 / 3) * p2(n) + (5 / 16) * p3(n) + (41 / 180) * p4(n),
      (13 / 48) * p2(n) - (3 / 5) * p3(n) + (557 / 1440) * p4(n),
      (61 / 240) * p3(n) - (103 / 140) * p4(n),
      (49561 / 161280) * p4(n),
    ];
    this.beta = [
      0.5 * n - (2 / 3) * p2(n) + (37 / 96) * p3(n) - (1 / 360) * p4(n),
      (1 / 48) * p2(n) + (1 / 15) * p3(n) - (437 / 1440) * p4(n),
      (17 / 480) * p3(n) - (37 / 840) * p4(n),
      (4397 / 161280) * p4(n),
    ];

    // Meridional arc to latitude of origin, φ₀ (radians). For φ₀=0 ⇒ M0=0 (UTM).
    this.M0 = this.#computeMeridionalArc(toRad(this.latitudeOfOrigin));
  }

  /** Forward: geodetic (φ,λ in degrees) → grid (northing,easting in meters). */
  geodeticToGrid(latitude: number, longitude: number): ForwardResult {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("latitude/longitude must be finite numbers");
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error("latitude must be in [-90, 90]");
    }
    if (Math.abs(latitude) === 90) {
      return {
        northing:
          this.falseNorthing +
          this.scale * (Math.sign(latitude) * this.B * (Math.PI / 2) - this.M0),
        easting: this.falseEasting,
      };
    }

    const φ = toRad(latitude);
    const λ = toRad(longitude);
    const λ0 = toRad(this.centralMeridian);
    const Δλ = λ - λ0;

    // Conformal latitude β via hyperbolic formula (robust)
    const Q = asinh(Math.tan(φ)) - this.e * atanh(this.e * Math.sin(φ));
    const β = Math.atan(sinh(Q));

    // Spherical TM ‘prime’ coordinates (ξ₀, η₀); use atan2 for quadrant safety
    const sinβ = Math.sin(β);
    const cosβ = Math.cos(β);
    const cosΔλ = Math.cos(Δλ);
    const sinΔλ = Math.sin(Δλ);

    const ξ0 = Math.atan2(sinβ, cosβ * cosΔλ);
    const η0 = atanh(cosβ * sinΔλ);

    // Apply α-series to get (ξ, η)
    const { alpha } = this;
    const twoξ0 = 2 * ξ0,
      fourξ0 = 4 * ξ0,
      sixξ0 = 6 * ξ0,
      eightξ0 = 8 * ξ0;
    const twoη0 = 2 * η0,
      fourη0 = 4 * η0,
      sixη0 = 6 * η0,
      eightη0 = 8 * η0;

    const ξ =
      ξ0 +
      alpha[0] * Math.sin(twoξ0) * cosh(twoη0) +
      alpha[1] * Math.sin(fourξ0) * cosh(fourη0) +
      alpha[2] * Math.sin(sixξ0) * cosh(sixη0) +
      alpha[3] * Math.sin(eightξ0) * cosh(eightη0);

    const η =
      η0 +
      alpha[0] * Math.cos(twoξ0) * Math.sinh(twoη0) +
      alpha[1] * Math.cos(fourξ0) * Math.sinh(fourη0) +
      alpha[2] * Math.cos(sixξ0) * Math.sinh(sixη0) +
      alpha[3] * Math.cos(eightξ0) * Math.sinh(eightη0);

    // Scale and false origin
    const E = this.falseEasting + this.scale * this.B * η;
    const N = this.falseNorthing + this.scale * (this.B * ξ - this.M0); // subtract meridional arc to φ₀

    return { northing: N, easting: E };
  }

  /** Inverse: grid (northing,easting in meters) → geodetic (φ,λ in degrees). */
  gridToGeodetic(northing: number, easting: number): InverseResult {
    if (!Number.isFinite(northing) || !Number.isFinite(easting)) {
      throw new Error("northing/easting must be finite numbers");
    }

    // Normalize to reduced coordinates
    const ξ =
      (northing - this.falseNorthing + this.scale * this.M0) /
      (this.scale * this.B);
    const η = (easting - this.falseEasting) / (this.scale * this.B);

    // Remove the α-series via β-series (ξ′, η′)
    const { beta } = this;
    const twoξ = 2 * ξ,
      fourξ = 4 * ξ,
      sixξ = 6 * ξ,
      eightξ = 8 * ξ;
    const twoη = 2 * η,
      fourη = 4 * η,
      sixη = 6 * η,
      eightη = 8 * η;

    const ξp =
      ξ -
      beta[0] * Math.sin(twoξ) * cosh(twoη) -
      beta[1] * Math.sin(fourξ) * cosh(fourη) -
      beta[2] * Math.sin(sixξ) * cosh(sixη) -
      beta[3] * Math.sin(eightξ) * cosh(eightη);

    const ηp =
      η -
      beta[0] * Math.cos(twoξ) * Math.sinh(twoη) -
      beta[1] * Math.cos(fourξ) * Math.sinh(fourη) -
      beta[2] * Math.cos(sixξ) * Math.sinh(sixη) -
      beta[3] * Math.cos(eightξ) * Math.sinh(eightη);

    // Recover tan(conformal latitude) without asin losing precision near the poles.
    // Karney's relation avoids subtracting nearly equal values when |sin ξ′| ≈ 1.
    const sinξp = Math.sin(ξp);
    const cosξp = Math.cos(ξp);
    const sinhηp = Math.sinh(ηp);
    if (sinhηp === 0 && Math.abs(cosξp) <= 4 * Number.EPSILON) {
      // Allow a few ulps from origin/scale arithmetic at an exact pole.
      // Longitude is undefined there; use the central meridian by convention.
      return {
        latitude: sinξp < 0 ? -90 : 90,
        longitude: this.centralMeridian,
      };
    }
    const tauPrime = sinξp / Math.hypot(sinhηp, cosξp);
    const Δλ = Math.atan2(sinhηp, cosξp);

    // Invert the conformal latitude using isometric latitude Q, not a rounded asin.
    const Q1 = asinh(tauPrime);
    let Q2 = Q1;
    // Iterate to convergence; 3–4 iterations are typical (EPSG). Clamp inside atanh.
    for (let i = 0; i < 6; i++) {
      const next = Q1 + this.e * atanh(this.e * tanh(Q2));
      if (Math.abs(next - Q2) < 1e-14) {
        Q2 = next;
        break;
      }
      Q2 = next;
    }
    const φ = Math.atan(sinh(Q2));
    const λ = toRad(this.centralMeridian) + Δλ;

    return { latitude: toDeg(φ), longitude: toDeg(λ) };
  }

  // --- internals ---

  #validateInput(): void {
    const { equatorialRadius: a, flattening: f, scale: k0 } = this;
    if (!Number.isFinite(a))
      throw new Error("equatorialRadius must be a finite number");
    if (!Number.isFinite(f))
      throw new Error("flattening must be a finite number");
    if (!Number.isFinite(this.centralMeridian))
      throw new Error("centralMeridian must be a finite number");
    if (!Number.isFinite(this.latitudeOfOrigin))
      throw new Error("latitudeOfOrigin must be a finite number");
    if (!Number.isFinite(k0))
      throw new Error("scale must be a finite number");
    if (!Number.isFinite(this.falseEasting))
      throw new Error("falseEasting must be a finite number");
    if (!Number.isFinite(this.falseNorthing))
      throw new Error("falseNorthing must be a finite number");
    if (!(a > 0)) throw new Error("equatorialRadius must be > 0");
    if (this.latitudeOfOrigin < -90 || this.latitudeOfOrigin > 90)
      throw new Error("latitudeOfOrigin must be in [-90, 90]");
    // Typical Earth ellipsoids: 0 < f < ~0.01 (WGS84 ≈ 0.0033528)
    if (!(f > 0 && f < 0.01))
      throw new Error("flattening must be in (0, 0.01)");
    if (!(k0 > 0 && k0 < 2)) throw new Error("scale must be in (0, 2)");
  }

  /** Compute meridional arc from equator to φ₀ using the JHS path. */
  #computeMeridionalArc(φ0: number): number {
    // Special cases (EPSG): φ₀ = 0 ⇒ 0; φ₀ = ±π/2 ⇒ ±B * π/2
    if (Math.abs(φ0) < 1e-20) return 0;
    if (Math.abs(Math.abs(φ0) - Math.PI / 2) < 1e-20) {
      return (φ0 > 0 ? 1 : -1) * this.B * (Math.PI / 2);
    }

    const Q0 = asinh(Math.tan(φ0)) - this.e * atanh(this.e * Math.sin(φ0));
    const β0 = Math.atan(sinh(Q0));
    const ξ00 = β0; // η0 = 0 when λ=λ0 ⇒ ξ0 = β0

    // ξ0 at origin includes α-series (η0=0 ⇒ cosh(2j*0)=1)
    const ξ0 =
      ξ00 +
      this.alpha[0] * Math.sin(2 * ξ00) +
      this.alpha[1] * Math.sin(4 * ξ00) +
      this.alpha[2] * Math.sin(6 * ξ00) +
      this.alpha[3] * Math.sin(8 * ξ00);

    return this.B * ξ0;
  }
}
