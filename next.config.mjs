/** @type {import('next').NextConfig} */
const config = {
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/dashboard.html', destination: '/dashboard', permanent: true },
    ];
  },
};
export default config;
