/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.moxfield.com' },
      { protocol: 'https', hostname: '**.moxfield.net' },
    ],
  },
};
export default nextConfig;
