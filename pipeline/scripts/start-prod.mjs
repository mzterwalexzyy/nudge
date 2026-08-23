import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = String(process.env.PORT || '3005');
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error(`Invalid PORT value: ${port}`);
}

const sessionSecret = process.env.SESSION_SECRET || '';
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
}

const dbPath = process.env.DB_PATH?.trim();
if (!dbPath) throw new Error('DB_PATH must be configured in production.');

const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '';
try {
  const parsed = new URL(appUrl);
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
} catch {
  throw new Error('APP_URL or RENDER_EXTERNAL_URL must be the public HTTPS origin, without a path, query, or hash.');
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: port,
  DB_PATH: dbPath,
  APP_URL: appUrl,
  SESSION_SECRET: sessionSecret,
};

const seedResult = spawnSync(
  process.execPath,
  [path.join(rootDir, 'pipeline', 'scripts', 'boot-seed.mjs')],
  { cwd: rootDir, env, stdio: 'inherit' }
);
if (seedResult.error) throw seedResult.error;
if (seedResult.status !== 0) process.exit(seedResult.status ?? 1);

const dashboardDir = path.join(rootDir, 'dashboard');
const nextBin = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(
  process.execPath,
  [nextBin, 'start', '-H', '0.0.0.0', '-p', port],
  { cwd: dashboardDir, env, stdio: 'inherit' }
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('error', (error) => {
  console.error(`[start-prod] failed to start Next: ${error.message}`);
  process.exit(1);
});
server.on('exit', (code, signal) => {
  if (signal) console.log(`[start-prod] Next exited after ${signal}`);
  process.exit(code ?? 0);
});
