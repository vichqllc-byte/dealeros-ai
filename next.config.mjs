/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    // @node-rs/argon2 ships native .node binaries; keep it out of the
    // webpack bundle so Node's native `require` loads it at runtime instead.
    serverComponentsExternalPackages: ['@node-rs/argon2']
  }
};

export default nextConfig;
