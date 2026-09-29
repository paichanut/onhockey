export const metadata = {
  title: 'OnHockey Live - Free Hockey Streams',
  description: 'Watch ice hockey live streams from NHL, KHL, Liiga, SHL and more. No ads, no redirects.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
