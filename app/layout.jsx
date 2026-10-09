import './globals.css';
export const metadata = {
  metadataBase: new URL('https://organic-dashboard-psi.vercel.app'),
  title: { default: 'Organic Growth', template: '%s | Organic Growth' },
  description: 'Your team’s performance center for organic traffic, content, and growth.',
  openGraph: {
    title: 'Organic Growth | Performance Center',
    description: 'Your team’s performance center for organic traffic, content, and growth.',
    siteName: 'Organic Growth',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Organic Growth | Performance Center',
    description: 'Your team’s performance center for organic traffic, content, and growth.',
    images: ['/opengraph-image'],
  },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
