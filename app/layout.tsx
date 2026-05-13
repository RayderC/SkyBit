import type { Metadata, Viewport } from 'next';
import './globals.css';
import { UploadProvider } from '@/components/UploadManager';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'SkyBit',
  description: 'Your personal cloud file explorer',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SkyBit',
  },
  icons: {
    apple: '/icons/apple-touch-icon-180x180.png',
    icon: '/favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c0eb3',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <UploadProvider>
          <Navigation />
          <main>{children}</main>
        </UploadProvider>
      </body>
    </html>
  );
}
