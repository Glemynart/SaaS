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
};

export default nextConfig;
