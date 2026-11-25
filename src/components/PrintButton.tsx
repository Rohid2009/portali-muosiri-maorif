'use client';

import { Icon } from './Icon';

export function PrintButton({ label = 'Чоп / PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost print:hidden">
      <Icon name="print" className="h-4 w-4" />
      {label}
    </button>
  );
}
