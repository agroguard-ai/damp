export function Highlight({ children, textClassName }: { children: React.ReactNode; textClassName?: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span className="absolute -inset-x-1 -bottom-[0.05em] -z-10 h-[0.75em] -rotate-1 bg-secondary-300/70 dark:bg-secondary-700/50" />
      <span className={`relative ${textClassName ?? ''}`}>{children}</span>
    </span>
  );
}
