import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import AgentationDev from '@/components/dev/AgentationDev';
import './globals.css';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Deskalia',
  description: 'Assistante virtuelle Deskalia',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${geist.variable} h-full`}>
      <body suppressHydrationWarning>
        {children}
        <AgentationDev />
      </body>
    </html>
  );
}