import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Ensure the CommonJS bundle lives inside its own package boundary
// so Node treats the .js files as CJS even though the root package
// is flagged as type: module.
const cjsDir = join(process.cwd(), 'dist-cjs');
await mkdir(cjsDir, { recursive: true });

const pkgPath = join(cjsDir, 'package.json');
const contents = JSON.stringify({ type: 'commonjs' }, null, 2) + '\n';
await writeFile(pkgPath, contents);
