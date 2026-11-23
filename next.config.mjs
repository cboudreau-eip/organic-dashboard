/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/content-work/assessment': ['node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs','node_modules/pdfjs-dist/package.json','node_modules/@napi-rs/canvas*/**/*'],
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/dashboard.html', destination: '/dashboard', permanent: true },
    ];
  },
};
export default config;
