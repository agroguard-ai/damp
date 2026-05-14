import { ClerkProvider } from '@clerk/nextjs';
import { Inter, DM_Sans } from 'next/font/google';
import '@/app/globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${dmSans.variable}`}>
      <body className="antialiased">
        <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider>
      </body>
    </html>
  );
}
