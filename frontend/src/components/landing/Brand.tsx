import { Hexagon } from 'lucide-react';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <Hexagon className="w-6 h-6 text-primary-600 fill-primary-600/10 shrink-0" />
      DAMP <span className="text-primary-700">Agro</span>
    </span>
  );
}
