import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StreamHub',
  description: 'Live streaming platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
