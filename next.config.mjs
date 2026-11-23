/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ['pdfjs-dist'],
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/dashboard.html', destination: '/dashboard', permanent: true },
    ];
  },
};
export default config;
