import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Imagen de producción liviana (copia solo lo necesario para `node server.js`,
  // sin arrastrar node_modules completo) — ver frontend/Dockerfile.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),
  productionBrowserSourceMaps: false,
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 2,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
    turbopackFileSystemCacheForDev: false,
    turbopackMemoryLimit: 512 * 1024 * 1024,
    turbopackSourceMaps: false,
    turbopackInputSourceMaps: false,
    mcpServer: false,
    optimizePackageImports: ['lucide-react', 'three', 'gsap', '@gsap/react', 'leaflet', 'react-leaflet'],
  },
};

export default nextConfig;
