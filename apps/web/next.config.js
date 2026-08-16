/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@pdf-saas/shared',
    '@pdf-saas/file-utils',
    '@pdf-saas/pdf-engine',
    '@pdf-saas/image-engine',
  ],
  webpack: (config) => {
    // pdf.js ships a prebuilt worker we serve as a static asset.
    config.resolve.alias.canvas = false;
    config.resolve.alias.fs = false;
    config.resolve.alias.path = false;
    return config;
  },
};

module.exports = nextConfig;
