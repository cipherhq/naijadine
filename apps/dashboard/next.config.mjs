/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@naijadine/db', '@naijadine/shared'],
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'prkghglugnvcwddsfrsm.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
