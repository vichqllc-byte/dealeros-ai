/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained .next/standalone build (only the files a
  // production server actually needs, node_modules pruned to runtime
  // deps) - see Dockerfile, which copies this output directly.
  output: 'standalone',
  experimental: {
    typedRoutes: true,
    // @node-rs/argon2 ships native .node binaries; keep it out of the
    // webpack bundle so Node's native `require` loads it at runtime instead.
    serverComponentsExternalPackages: ['@node-rs/argon2'],
    // Enables instrumentation.ts's register() hook (startup env
    // validation). Harmless if already stable/default in this Next
    // version - an unrecognized experimental key just warns, not fails.
    instrumentationHook: true
  }
};

export default nextConfig;
