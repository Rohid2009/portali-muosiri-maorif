'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Ҳар чанд сония саҳифаро аз сервер нав мекунад (танҳо вақте ки ҷадвал кушода аст) — барои паёмҳои нав */
export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

/** Ба поёни рӯйхати паёмҳо мегузарад */
export function ScrollToEnd({ dep }: { dep: number }) {
  useEffect(() => {
    document.getElementById('chat-end')?.scrollIntoView({ block: 'end' });
  }, [dep]);
  return <div id="chat-end" />;
}
