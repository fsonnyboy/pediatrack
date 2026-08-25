import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
// Tabular numerals for the growth chart's axes, stats and history table.
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: {
    default: 'PediTrack',
    template: '%s · PediTrack',
  },
  description: 'Pediatric clinic management — patients, check-ups, vaccines and prescriptions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
