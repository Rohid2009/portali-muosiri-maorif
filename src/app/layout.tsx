import type { Metadata, Viewport } from 'next';
import { Inter, Marck_Script } from 'next/font/google';
import './globals.css';
import { currentTheme } from '@/lib/theme';

// Шрифт ҳангоми build бор шуда, аз худи сервер дода мешавад (на аз Google) — ҳарфҳои ӣ ҳ ҷ ғ қ ӯ дар cyrillic-ext.
const inter = Inter({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-inter', display: 'swap' });
// Хатти шиори «Маориф — калиди оянда!»
const script = Marck_Script({ weight: '400', subsets: ['latin', 'cyrillic'], variable: '--font-script', display: 'swap' });

export const metadata: Metadata = {
  title: 'Портали муосири маориф',
  description: 'Журнали электронии мактаб',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#071637',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tg" className={`${inter.variable} ${script.variable} ${currentTheme() === 'dark' ? 'dark' : ''}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
