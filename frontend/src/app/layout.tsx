import { ClerkProvider } from '@clerk/nextjs';
import { Inter, DM_Sans } from 'next/font/google';
import '@/app/globals.css';
import { ToastProvider } from '@/context/ToastContext';

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
    <html lang="es" className={`${inter.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <ClerkProvider afterSignOutUrl="/">
          <ToastProvider>{children}</ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
