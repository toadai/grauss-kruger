import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run this script with npm run test:package');
const temporary = mkdtempSync(join(tmpdir(), 'grauss-kruger-package-'));

function run(command, args, cwd = temporary) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

try {
  // Build is performed by the npm script. Avoid lifecycle recursion and pack only
  // that clean build; consumers below never resolve against the working tree.
  const [packed] = JSON.parse(run(process.execPath, [
    npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary,
  ], root));
  const archive = join(temporary, packed.filename);
  const files = new Set(packed.files.map(({ path }) => path));
  const forbidden = /(^|\/)(?:test|tests|__tests__|\.test-dist|\.example-dist)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]s$/;
  for (const path of files) {
    assert.ok(!forbidden.test(path), `Test artifact was packed: ${path}`);
    assert.ok(/^(?:dist\/|dist-cjs\/|src\/|package\.json$|README\.md$|LICENSE$)/.test(path), `Unexpected package file: ${path}`);
  }

  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(process.execPath, [
    npm, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    '--package-lock=false', '--omit=dev', archive,
  ]);
  const installed = join(temporary, 'node_modules', '@canetoad', 'grauss-kruger');
  const manifest = readJson(join(installed, 'package.json'));

  function packageFile(path) {
    assert.equal(typeof path, 'string', 'Package paths must be strings');
    const absolute = resolve(installed, path);
    const local = relative(installed, absolute);
    assert.ok(local && !local.startsWith(`..${sep}`) && local !== '..' && !isAbsolute(local), `Path escapes package: ${path}`);
    assert.ok(existsSync(absolute), `Missing package file: ${path}`);
    assert.ok(files.has(local.split(sep).join('/')), `File missing from tarball: ${path}`);
    return absolute;
  }

  for (const field of ['main', 'module', 'types']) packageFile(manifest[field]);
  const entry = manifest.exports['.'];
  for (const condition of ['import', 'require']) {
    assert.equal(Object.keys(entry[condition])[0], 'types', `${condition} types must precede runtime conditions`);
    packageFile(entry[condition].types);
    packageFile(entry[condition].default);
  }
  assert.equal(readJson(packageFile('dist-cjs/package.json')).type, 'commonjs');

  for (const path of files) {
    if (path.startsWith('src/') && path.endsWith('.ts')) {
      const emitted = path.slice('src/'.length, -'.ts'.length);
      for (const output of ['dist', 'dist-cjs']) {
        for (const extension of ['.js', '.js.map', '.d.ts', '.d.ts.map']) {
          packageFile(`${output}/${emitted}${extension}`);
        }
      }
    }
    if (!path.endsWith('.map')) continue;
    const mapPath = packageFile(path);
    const map = readJson(mapPath);
    assert.equal(map.version, 3, `Invalid source map: ${path}`);
    assert.ok(map.sources.length > 0, `Empty source map: ${path}`);
    assert.ok(existsSync(resolve(dirname(mapPath), map.file)), `Missing mapped output: ${path}`);
    for (const [index, source] of map.sources.entries()) {
      const sourcePath = resolve(dirname(mapPath), map.sourceRoot ?? '', source);
      if (map.sourcesContent?.[index] == null) {
        packageFile(relative(installed, sourcePath));
      }
    }
  }
  for (const path of files) {
    if (!/\.(?:js|d\.ts)$/.test(path)) continue;
    const content = readFileSync(packageFile(path), 'utf8');
    for (const match of content.matchAll(/\/\/# sourceMappingURL=(\S+)/g)) {
      if (!match[1].startsWith('data:')) {
        packageFile(relative(installed, resolve(dirname(join(installed, path)), match[1])));
      }
    }
  }

  const assertions = `
const point = projectMGA2020(-33.8688, 151.2093);
assert.equal(point.zone, 56);
assert.ok(Math.abs(point.easting - 334368.63) < 0.01, 'Sydney easting');
assert.ok(Math.abs(point.northing - 6250948.35) < 0.01, 'Sydney northing');
const back = inverseMGA2020(point.zone, point.easting, point.northing);
assert.ok(Math.abs(back.latitude + 33.8688) < 1e-8, 'Sydney inverse latitude');
assert.ok(Math.abs(back.longitude - 151.2093) < 1e-8, 'Sydney inverse longitude');
assert.equal(mga2020ZoneFromLongitude(153), 56);
const origin = createMGA2020(56).geodeticToGrid(0, 153);
assert.equal(origin.easting, 500000);
assert.equal(origin.northing, 10000000);
`;
  const members = 'projectMGA2020, inverseMGA2020, mga2020ZoneFromLongitude, createMGA2020';
  writeFileSync(join(temporary, 'runtime.mjs'), `import assert from 'node:assert/strict';\nimport { ${members} } from '@canetoad/grauss-kruger';\n${assertions}`);
  writeFileSync(join(temporary, 'runtime.cjs'), `const assert = require('node:assert/strict');\nconst { ${members} } = require('@canetoad/grauss-kruger');\n${assertions}`);
  run(process.execPath, ['runtime.mjs']);
  run(process.execPath, ['runtime.cjs']);

  const consumer = `
import { GaussKrugerProjection, projectMGA2020, inverseMGA2020, createMGA2020, type MGA2020Zone, type GaussKrugerProjectionOptions } from '@canetoad/grauss-kruger';
const zone: MGA2020Zone = 56;
const options: GaussKrugerProjectionOptions = {
  equatorialRadius: 6378137, flattening: 1 / 298.257222101,
  centralMeridian: 153, latitudeOfOrigin: 0, scale: 0.9996,
  falseEasting: 500000, falseNorthing: 10000000,
};
const custom = new GaussKrugerProjection(options);
const projected = projectMGA2020(-33.8688, 151.2093);
const latitude: number = inverseMGA2020(zone, projected.easting, projected.northing).latitude;
const easting: number = createMGA2020(zone).geodeticToGrid(latitude, 151.2093).easting;
custom.gridToGeodetic(projected.northing, easting);
`;
  writeFileSync(join(temporary, 'consumer.mts'), consumer);
  writeFileSync(join(temporary, 'consumer.cts'), consumer);
  const compiler = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  for (const mode of ['Node16', 'NodeNext']) {
    const config = `tsconfig.${mode}.json`;
    writeFileSync(join(temporary, config), JSON.stringify({
      compilerOptions: {
        target: 'ES2020', module: mode, moduleResolution: mode,
        strict: true, skipLibCheck: false, types: [], outDir: `compiled-${mode}`,
      },
      files: ['consumer.mts', 'consumer.cts'],
    }));
    run(process.execPath, [compiler, '-p', config]);
    run(process.execPath, [join(`compiled-${mode}`, 'consumer.mjs')]);
    run(process.execPath, [join(`compiled-${mode}`, 'consumer.cjs')]);
  }

  if (process.env.PACKAGE_OUTPUT_DIR) {
    const output = resolve(root, process.env.PACKAGE_OUTPUT_DIR);
    mkdirSync(output, { recursive: true });
    copyFileSync(archive, join(output, packed.filename));
    console.log(`Verified artifact: ${join(output, packed.filename)}`);
  }
  console.log('Package verified: ESM/CJS runtime, Node16/NodeNext TypeScript consumers, declarations, maps, and artifact hygiene.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
