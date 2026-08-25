/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@streamhub/ui', '@streamhub/types'],
};

module.exports = nextConfig;
