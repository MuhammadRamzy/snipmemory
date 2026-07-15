"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useApp } from '../../../context/AppContext';

export default function SalonRootRedirect() {
  const router = useRouter();
  const params = useParams();
  const salonId = params.salonId;
  const { currentSalon, salonMode } = useApp();

  useEffect(() => {
    if (currentSalon && currentSalon.id === salonId) {
      if (salonMode === 'owner') {
        router.push(`/salon/${salonId}/dashboard`);
      } else {
        router.push(`/salon/${salonId}/barber`);
      }
    } else {
      router.push(`/salon/${salonId}/login`);
    }
  }, [currentSalon, salonId, salonMode, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Redirecting to workspace...</div>
    </div>
  );
}
