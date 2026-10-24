import React from 'react';

export function DampLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* Outer hexagon */}
      <polygon
        points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
        fill="#22c55e"
        fillOpacity="0.08"
        stroke="#22c55e"
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      {/* Inner thinner hexagon */}
      <polygon
        points="50,14 81.2,32 81.2,68 50,86 18.8,68 18.8,32"
        stroke="#22c55e"
        strokeOpacity="0.45"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Outer dashed circle */}
      <circle
        cx="50"
        cy="50"
        r="28.5"
        stroke="#4ade80"
        strokeOpacity="0.65"
        strokeWidth="2.2"
        strokeDasharray="3.6 4.4"
        strokeLinecap="round"
      />
      {/* Middle dashed circle */}
      <circle
        cx="50"
        cy="50"
        r="19.5"
        stroke="#4ade80"
        strokeOpacity="0.65"
        strokeWidth="2.2"
        strokeDasharray="3.4 4.2"
        strokeLinecap="round"
      />
      {/* Inner solid green circle */}
      <circle
        cx="50"
        cy="50"
        r="10.8"
        fill="#22c55e"
        fillOpacity="0.14"
        stroke="#4ade80"
        strokeWidth="3.4"
      />
      {/* Center yellow/amber dot */}
      <circle cx="50" cy="50" r="4.8" fill="#ffc107" />
    </svg>
  );
}

export function Brand({ className = '', logoClassName = 'w-7 h-7' }: { className?: string; logoClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${className}`}>
      <DampLogo className={logoClassName} />
      <span>
        DAMP <span className="text-primary-700">Agro</span>
      </span>
    </span>
  );
}
