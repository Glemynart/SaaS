import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(appDir, '../..');

const nextConfig: NextConfig = {
  serverExternalPackages: ['isomorphic-dompurify'],
  turbopack: {
    root: workspaceDir,
  },
  async headers() {
    return ['/restablecer', '/reset-password'].map((source) => ({
      source,
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    }));
  },
};

export default nextConfig;
