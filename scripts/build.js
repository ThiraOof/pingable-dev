import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = await build({
  entryPoints: [join(root, 'src/public/js/components/index.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: join(root, 'src/public/js/bundle.js'),
  logLevel: 'info',
});

const msg = result.errors.length ? 'build failed' : 'bundle → src/public/js/bundle.js';
console.log(msg);
