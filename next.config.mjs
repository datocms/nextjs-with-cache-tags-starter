/** @type {import('next').NextConfig} */
const nextConfig = {
  // `@libsql/client` relies on a native binding when it talks to a local
  // `file:` database (used by the E2E test-suite), so it must not be bundled.
  serverExternalPackages: ['@libsql/client', 'libsql'],
};

export default nextConfig;
