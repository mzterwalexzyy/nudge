import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const baseConfig = {
  transpilePackages: ['@second-brain/pipeline'],
  // better-sqlite3 is a native module; keep it external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default (phase) => ({
  ...baseConfig,
  // Keep `next dev` from overwriting production artifacts while both run locally.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
