# Gauss–Krüger (Transverse Mercator)

A TypeScript implementation of the EPSG Transverse Mercator method (9807), using fourth-order Krüger series and JavaScript double-precision arithmetic. Includes mainland Australian MGA2020 helpers, TypeScript declarations, and ESM/CommonJS entry points. No runtime dependencies. Node.js 18 or later is required.

## Quick start

```sh
npm install @canetoad/grauss-kruger
```

```typescript
import { createMGA2020 } from "@canetoad/grauss-kruger";

const projection = createMGA2020(56);
// Illustrative Sydney coordinate: interpret these angles as GDA2020.
const grid = projection.geodeticToGrid(-33.8688, 151.2093);
console.log(grid.easting, grid.northing); // metres

// Class inverse takes NORTHING first.
const geographic = projection.gridToGeodetic(grid.northing, grid.easting);
console.log(geographic.latitude, geographic.longitude); // decimal degrees
```

CommonJS consumers can use `const { createMGA2020 } = require("@canetoad/grauss-kruger");`.

**Projection is not datum transformation.** Geographic input must already use the datum associated with your projection: GDA2020 for MGA2020, WGS84 for a WGS84 configuration, or OSGB36 for a British National Grid configuration. Supplying GPS/WGS84 angles to an MGA2020 or OSGB36 projection does not transform their datum or coordinate epoch.

## Choose an MGA2020 zone

```typescript
import {
  projectMGA2020,
  inverseMGA2020,
} from "@canetoad/grauss-kruger";

const grid = projectMGA2020(-33.8688, 151.2093);
// Wrapper inverse takes EASTING first, unlike the class method.
const geographic = inverseMGA2020(grid.zone, grid.easting, grid.northing);
```

Automatic zone selection uses `floor((longitude + 180) / 6) + 1`, then deliberately clamps to mainland zones **49–56**. This is not a worldwide UTM zone selector or a check that a point lies in Australia. For finite longitudes outside that range it returns an endpoint zone; do not use that result as evidence the projection is suitable. Select a fixed zone with `createMGA2020(zone)` when your dataset specifies one. MGA2020 helpers use GRS80, scale 0.9996, false easting 500,000 m and southern-hemisphere false northing 10,000,000 m.

## API reference

All angles are decimal degrees; all grid coordinates and radii are metres. Scale and flattening are dimensionless. Returned objects use named properties; do not infer argument order from property order.

### `GaussKrugerProjection`

```typescript
import {
  GaussKrugerProjection,
  type GaussKrugerProjectionOptions,
  type MGA2020Zone,
} from "@canetoad/grauss-kruger";

const options: GaussKrugerProjectionOptions = { centralMeridian: -123 };
const projection = new GaussKrugerProjection(options);
const zone: MGA2020Zone = 56;
```

| Constructor option | Default | Meaning |
| --- | --- | --- |
| `equatorialRadius` | `6378137` | Ellipsoid semi-major axis, metres |
| `flattening` | `1 / 298.257223563` | WGS84 flattening |
| `centralMeridian` | `15` | Central meridian, degrees |
| `latitudeOfOrigin` | `0` | Latitude of origin, degrees |
| `scale` | `0.9996` | Central-meridian scale factor |
| `falseEasting` | `500000` | Easting offset, metres |
| `falseNorthing` | `0` | Northing offset, metres |

The defaults are WGS84 / UTM zone 33N-like parameters, **not** a global projection. Configure the appropriate zone and hemisphere for your data.

| Method | Result |
| --- | --- |
| `geodeticToGrid(latitude, longitude)` | `{ northing, easting }` |
| `gridToGeodetic(northing, easting)` | `{ latitude, longitude }` |

### Validation and longitude representation

All constructor options and coordinate inputs must be finite. Latitude and latitude of origin must be in **[−90°, 90°]**. Radius must be positive, flattening must be in `(0, 0.01)`, and scale must be in `(0, 2)`. MGA zone arguments must be integers from 49 through 56; invalid values are rejected at runtime as well as restricted by the exported zone type.

Finite longitude inputs may use wrapped representations (for example, 151° and −209°). Automatic MGA zone selection deliberately uses the supplied longitude without wrap normalization, so equivalent wrapped longitudes can select different clamped zones. Inverse longitude is represented relative to the configured central meridian (central meridian plus an `atan2` offset of up to ±180°), not necessarily in the global interval [−180°, 180°]. At an exact pole it uses the central meridian as a convention.

### MGA2020 helpers

| Function | Result |
| --- | --- |
| `mga2020ZoneFromLongitude(longitude)` | Zone clamped to 49–56 |
| `mga2020CentralMeridian(zone)` | `6 * zone - 183`, degrees |
| `createMGA2020(zone)` | Configured `GaussKrugerProjection` |
| `projectMGA2020(latitude, longitude)` | `{ zone, easting, northing }` |
| `inverseMGA2020(zone, easting, northing)` | `{ latitude, longitude }` |

`MGA2020Zone` is the union `49 | 50 | 51 | 52 | 53 | 54 | 55 | 56`.

## Configure another grid

For WGS84 / UTM zone 10N, supply WGS84 geographic coordinates:

```typescript
import { GaussKrugerProjection } from "@canetoad/grauss-kruger";

const utm10 = new GaussKrugerProjection({ centralMeridian: -123 });
const grid = utm10.geodeticToGrid(37.7749, -122.4194);
```

For British National Grid, configure Airy 1830 and **supply OSGB36 geographic coordinates**, not untransformed WGS84 coordinates:

```typescript
import { GaussKrugerProjection } from "@canetoad/grauss-kruger";

const nationalGrid = new GaussKrugerProjection({
  equatorialRadius: 6377563.396,
  flattening: 1 / 299.3249646,
  centralMeridian: -2,
  latitudeOfOrigin: 49,
  scale: 0.9996012717,
  falseEasting: 400000,
  falseNorthing: -100000,
});
const origin = nationalGrid.geodeticToGrid(49, -2);
```

## Accuracy and limits

This is a **fourth-order** series implementation, not an exact Transverse Mercator solver. JavaScript numbers use IEEE 754 double precision; series truncation, floating-point error, distance from the central meridian, and datum/epoch uncertainty are separate error sources. Ordinary UTM zones extend about ±3° from their central meridian. Prefer the intended grid zone rather than extrapolating far beyond it.

An audit comparison against PROJ 9.8.1 sampled 3,649 forward points over latitudes −88° to 88° and central-meridian offsets −40° to 40°. The largest observed forward difference was approximately **0.0000203 m**. A separate 231-point inverse sample had a largest observed angular difference of **4.69 × 10⁻¹³ degrees**. These are observations for those samples, **not global error bounds**, guarantees for arbitrary ellipsoids or grid coordinates, or a substitute for independent validation of your application.

Forward/inverse round trips are approximate. Longitude is not uniquely defined at the poles, and no exact round-trip or global/polar accuracy guarantee is made. Validate results against authoritative control points for surveying or other accuracy-sensitive work.

## Development and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for local checks and release instructions, [SECURITY.md](SECURITY.md) for private vulnerability reporting, and [CHANGELOG.md](CHANGELOG.md) for unreleased changes.

Source and issue tracker: [toadai/grauss-kruger](https://github.com/toadai/grauss-kruger).

## References

- [EPSG method 9807: Transverse Mercator](https://epsg.org/coord-operation-method_9807/Transverse-Mercator.html), with formulas in IOGP/EPSG Guidance Note 7-2.
- [Karney, *Transverse Mercator with an accuracy of a few nanometers* (2011)](https://doi.org/10.1007/s00190-011-0445-3). Explains series accuracy and exact approaches; its higher-order accuracy claims do not describe this fourth-order implementation.
- [Geoscience Australia: GDA2020](https://www.ga.gov.au/scientific-topics/positioning-navigation/geodesy/datums-projections/gda2020) for the Australian datum and technical guidance.

## License

MIT; see [LICENSE](LICENSE).
