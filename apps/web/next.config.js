/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // GitHub Pages project site: https://sufyanjaxs.github.io/pdf-saas/
  // (remove/empty when deploying to a custom domain or the user site root)
  basePath: '/pdf-saas',
  assetPrefix: '/pdf-saas/',
  transpilePackages: [
    '@pdf-saas/shared',
    '@pdf-saas/file-utils',
    '@pdf-saas/pdf-engine',
    '@pdf-saas/image-engine',
  ],
  webpack: (config, { isServer }) => {
    // pdf.js ships a prebuilt worker we serve as a static asset.
    config.resolve.alias.canvas = false;
    config.resolve.alias.fs = false;
    config.resolve.alias.path = false;
    if (!isServer) {
      // Office libs (pptxgenjs) import Node built-ins behind guards. In the
      // browser those must resolve to `false` so webpack skips them.
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        https: false,
        express: false,
        'image-size': false,
        os: false,
        path: false,
      };
      // `node:fs` style specifiers aren't handled by resolve.fallback; strip the
      // `node:` prefix first so the fallback above applies.
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
