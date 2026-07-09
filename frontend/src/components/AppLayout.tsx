'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If this is an auth page, render without the Sidebar and Topbar wrapper
  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans">
      <Sidebar />

      {/* Main Panel Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">{children}</main>
      </div>
    </div>
  );
}
