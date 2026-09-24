'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CercosZoneRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: zoneId } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (zoneId) {
      router.replace(`/cercos?zoneId=${zoneId}`);
    }
  }, [zoneId, router]);

  return (
    <div className="flex justify-center items-center py-24">
      <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-600 rounded-full animate-spin"></div>
    </div>
  );
}
