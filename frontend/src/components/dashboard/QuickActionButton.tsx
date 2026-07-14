import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function QuickActionButton({ href, label, icon: Icon }: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className="group flex items-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-150/50 dark:bg-[#18181b] text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-[#212124] transition-all duration-300 font-medium text-sm"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-green-600 dark:text-green-500 transition-transform duration-300 group-hover:scale-110" />
        <span>{label}</span>
      </div>
    </Link>
  );
}
