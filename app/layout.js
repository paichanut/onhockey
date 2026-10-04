import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata = {
  title: 'OnHockey Live - Free Hockey Streams',
  description: 'Watch ice hockey live streams from NHL, KHL, Liiga, SHL and more. No ads, no redirects.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
