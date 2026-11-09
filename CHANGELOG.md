# Changelog

## 1.0.1 — 2026-11-09

### Fixed

- Improve inverse numerical behavior near the poles and retain a conventional central-meridian longitude at exact poles.
- Validate finite projection options and coordinate inputs, latitude bounds, and integer MGA2020 zones while preserving deliberate mainland zone clamping to 49–56 for finite longitudes.
- Provide module-appropriate ESM and CommonJS TypeScript declarations, exclude compiled tests from the package, and include sources required by published maps.
- Run examples through the built package entry point and remove obsolete development tooling and vulnerable dependency paths.
- Correct scoped package imports and the quick start; document datum requirements, units, argument order, longitude representation, and measured rather than unconditional accuracy claims.

### Added

- Clean-tarball runtime, TypeScript consumer, and artifact-hygiene checks.
- GitHub checks for numerical tests, typechecking, package consumers, and examples across the supported Node.js matrix.
- A manually dispatched, tag-validated release workflow with an approval environment and npm trusted-publishing integration; external account and repository settings still require maintainer configuration.
- Contributor, release, and private security-reporting guidance.
