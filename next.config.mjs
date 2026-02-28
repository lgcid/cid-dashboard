/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: []
  },
  outputFileTracingIncludes: {
    "/*": ["./data/csv/**/*.csv", "./data/csv/sections/**/*.csv"]
  }
};

export default nextConfig;
