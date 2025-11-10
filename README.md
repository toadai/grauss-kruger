# Gauss-Krüger (Transverse Mercator) Projection

A TypeScript implementation of robust Gauss–Krüger (Transverse Mercator) forward/inverse projection utilities using the EPSG JHS formulation.

## Features

- **Typed TypeScript** - Full TypeScript support with comprehensive type definitions
- **EPSG JHS Formulation** - Uses the robust IOGP/EPSG Guidance Note 7-2 method
- **MGA2020 Support** - Built-in support for Australian Map Grid 2020 zones
- **High Precision** - Stable to ~±40° longitude from central meridian
- **Zero Dependencies** - Pure TypeScript implementation with no external dependencies
- **ESM/CJS Dual** - Supports both ES modules and CommonJS

## Installation

```bash
npm install gauss-kruger
# or
yarn add gauss-kruger
# or
pnpm add gauss-kruger
```

## Quick Start

```typescript
import { GaussKrugerProjection } from 'gauss-kruger';

// Create projection with WGS84/UTM-like defaults (Zone 33 style)
const proj = new GaussKrugerProjection();

// Forward projection: geographic → grid
const { northing, easting } = proj.geodeticToGrid(-33.86, 151.21);
console.log(`Easting: ${easting.toFixed(2)}m, Northing: ${northing.toFixed(2)}m`);

// Inverse projection: grid → geographic  
const { latitude, longitude } = proj.gridToGeodetic(northing, easting);
console.log(`Latitude: ${latitude.toFixed(6)}°, Longitude: ${longitude.toFixed(6)}°`);
```

## MGA2020 (Australian Map Grid 2020)

Built-in support for Australian MGA2020 zones:

```typescript
import { 
  projectMGA2020, 
  inverseMGA2020, 
  mga2020ZoneFromLongitude 
} from 'gauss-kruger';

// Project Sydney coordinates to MGA2020
const sydney = { latitude: -33.8688, longitude: 151.2093 };
const { zone, easting, northing } = projectMGA2020(sydney.latitude, sydney.longitude);
console.log(`MGA2020 Zone ${zone}: E=${easting}m, N=${northing}m`);

// Inverse projection
const back = inverseMGA2020(zone, easting, northing);
console.log(`Back to: ${back.latitude}°, ${back.longitude}°`);
```

## API Reference

### GaussKrugerProjection

Main class for Gauss-Krüger projections.

#### Constructor

```typescript
new GaussKrugerProjection(options?: GaussKrugerProjectionOptions)
```

**Options:**
- `equatorialRadius?: number` - Semi-major axis in meters (default: 6378137.0)
- `flattening?: number` - Ellipsoid flattening (default: 1/298.257223563)
- `centralMeridian?: number` - Central meridian in degrees (default: 15)
- `latitudeOfOrigin?: number` - Latitude of origin in degrees (default: 0)
- `scale?: number` - Scale factor at central meridian (default: 0.9996)
- `falseEasting?: number` - False easting in meters (default: 500000)
- `falseNorthing?: number` - False northing in meters (default: 0)

#### Methods

- `geodeticToGrid(latitude: number, longitude: number): { northing: number, easting: number }`
- `gridToGeodetic(northing: number, easting: number): { latitude: number, longitude: number }`

### MGA2020 Functions

- `mga2020ZoneFromLongitude(longitude: number): MGA2020Zone` - Get zone from longitude
- `mga2020CentralMeridian(zone: number): number` - Get central meridian for zone
- `createMGA2020(zone: MGA2020Zone): GaussKrugerProjection` - Create MGA2020 projection
- `projectMGA2020(latitude: number, longitude: number): { zone: MGA2020Zone, easting: number, northing: number }`
- `inverseMGA2020(zone: MGA2020Zone, easting: number, northing: number): { latitude: number, longitude: number }`

## Examples

### Custom Projection (UTM Zone 10)

```typescript
import { GaussKrugerProjection } from 'gauss-kruger';

const utm10 = new GaussKrugerProjection({
  centralMeridian: -123,  // UTM Zone 10 central meridian
  scale: 0.9996,
  falseEasting: 500000,
  falseNorthing: 0
});

const point = utm10.geodeticToGrid(37.7749, -122.4194); // San Francisco
console.log(point);
```

### British National Grid (OSGB36)

```typescript
import { GaussKrugerProjection } from 'gauss-kruger';

const osgb36 = new GaussKrugerProjection({
  equatorialRadius: 6377563.396,
  flattening: 1 / 299.3249646,
  centralMeridian: -2,
  latitudeOfOrigin: 49,
  scale: 0.9996012717,
  falseEasting: 400000,
  falseNorthing: -100000
});

const london = osgb36.geodeticToGrid(51.5074, -0.1278);
console.log(london);
```

## Coordinate Systems

### Input/Output Units

- **Angles**: Degrees (decimal)
- **Linear**: Meters

### Supported Ellipsoids

- WGS84 (default)
- GRS80 (used in MGA2020)
- Custom ellipsoids via constructor parameters

## Accuracy

- **Longitude range**: Stable to ~±40° from central meridian
- **UTM usage**: Designed for ±3° (standard UTM range)
- **Precision**: Sub-millimeter precision for typical use cases
- **Round-trip**: Forward → inverse returns original coordinates within numerical precision

## TypeScript Support

Full TypeScript definitions included:

```typescript
import { 
  GaussKrugerProjection, 
  GaussKrugerProjectionOptions,
  MGA2020Zone 
} from 'gauss-kruger';

const options: GaussKrugerProjectionOptions = {
  centralMeridian: 135,
  scale: 0.9996
};

const proj = new GaussKrugerProjection(options);
const zone: MGA2020Zone = 56; // Type-safe zone numbers
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## References

- IOGP/EPSG Guidance Note 7-2, "Transverse Mercator (JHS formulas)" (2019)
- Lantmäteriet, "Gauss Conformal Projection (Transverse Mercator) — Krüger's formulas" (2008)
- Geoscience Australia, "GDA2020 / MGA2020" technical documentation

## License

MIT License - see LICENSE file for details.