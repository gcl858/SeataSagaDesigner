import type {NextConfig} from 'next';

const isGitHubPages = process.env.BUILD_TARGET === 'github-pages';
const rawPagesBasePath = (
  process.env.GITHUB_PAGES_BASE_PATH || '/SeataSagaDesigner'
).trim();
const githubPagesBasePath = rawPagesBasePath.startsWith('/')
  ? rawPagesBasePath.replace(/\/+$/, '')
  : `/${rawPagesBasePath.replace(/\/+$/, '')}`;
const basePath = isGitHubPages ? githubPagesBasePath : '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // Allow access to remote image placeholder.
  images: {
    ...(isGitHubPages ? {unoptimized: true} : {}),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: isGitHubPages ? 'export' : 'standalone',
  ...(isGitHubPages
    ? {
        basePath,
        trailingSlash: true,
      }
    : {}),
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
