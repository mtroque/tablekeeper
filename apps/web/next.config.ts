import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@tablekeeper/core', '@tablekeeper/cv'],
  reactStrictMode: true,
};

export default config;
