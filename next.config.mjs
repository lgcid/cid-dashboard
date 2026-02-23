/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: []
  },
  outputFileTracingIncludes: {
    "/*": ["./data/exports/**/*.csv"]
  }
};

export default nextConfig;
