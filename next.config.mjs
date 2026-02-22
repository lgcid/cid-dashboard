/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: []
  },
  experimental: {
    outputFileTracingIncludes: {
      "/*": ["./data/exports/**/*.csv"]
    }
  }
};

export default nextConfig;
