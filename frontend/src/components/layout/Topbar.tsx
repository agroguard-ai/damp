'use client';

import { UserButton } from '@clerk/nextjs';

export default function Topbar() {
  return (
    <header className="h-16 flex items-center justify-between gap-4 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
      <div className="flex items-center gap-4 shrink-0">
        <UserButton />
      </div>
    </header>
  );
}
