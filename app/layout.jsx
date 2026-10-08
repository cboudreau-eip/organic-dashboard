import './globals.css';
export const metadata = {
  title: { default: 'Organic Growth', template: '%s | Organic Growth' },
  description: 'Organic Growth team performance dashboard. Currently uses synthetic demo data.',
};
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
