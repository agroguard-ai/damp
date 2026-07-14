import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}

export function KpiCard({ title, value, icon, footer }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-wider">
          <span>{title}</span>
          {icon}
        </div>
        <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">{value}</div>
      </div>
      {footer && <div className="mt-4 text-xs flex items-center gap-1.5">{footer}</div>}
    </div>
  );
}
