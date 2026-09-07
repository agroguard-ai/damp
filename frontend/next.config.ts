import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Imagen de producción liviana (copia solo lo necesario para `node server.js`,
  // sin arrastrar node_modules completo) — ver frontend/Dockerfile.
  output: 'standalone',
};

export default nextConfig;
