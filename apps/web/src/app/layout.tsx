import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StreamHub',
  description: 'Live streaming platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-surface-container-lowest text-on-surface font-body-md antialiased min-h-screen flex flex-col md:flex-row overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 md:ml-16 xl:ml-60 flex flex-col min-h-screen">
          <Navbar />
          {children}
        </main>
      </body>
    </html>
  );
}
