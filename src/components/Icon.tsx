// Нишонаҳои хаттӣ (SVG) — бе китобхонаи беруна, вазни сифр.
const PATHS = {
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h5',
  family: 'M5 7a3 3 0 1 0 6 0 3 3 0 1 0-6 0M14.7 9a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 1 0-4.6 0M2.5 20a5.5 5.5 0 0 1 11 0M13.5 20a3.8 3.8 0 0 1 7.5 0',
  clip: 'M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4V3h6v1M9 10h6M9 14h6M9 18h3',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  out: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4',
  users: 'M5.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5.5 5.5 0 0 1 3.5 6',
  cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  check: 'm5 12 4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  down: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  print: 'M6 9V3h12v6M6 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-2M7 14h10v7H7z',
  plus: 'M12 5v14M5 12h14',
  key: 'M8 15a4 4 0 1 1 3.5-6H21v3h-2v3h-3v-3h-4.5A4 4 0 0 1 8 15z',
  back: 'M19 12H5M11 6l-6 6 6 6',
  house: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5',
  user: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0',
  case: 'M5.5 7h13A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-8A2.5 2.5 0 0 1 5.5 7zM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M10 12.5v2h4v-2',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Нишони портал: китоби кушода ва кулоҳи хатм дар квадрати кабуд */
export function Logo({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 drop-shadow-[0_6px_16px_rgba(42,123,255,.45)] ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2f86ff" /><stop offset="1" stopColor="#0d3fb5" /></linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#logo-bg)" />
      <rect x="2.5" y="2.5" width="59" height="59" rx="15.5" fill="none" stroke="rgba(255,255,255,.35)" />
      <path d="M10 33c7-3 14-3 22 2 8-5 15-5 22-2v15c-7-3-14-3-22 2-8-5-15-5-22-2z" fill="#fff" />
      <path d="M32 35v15" stroke="#2a6fe8" strokeWidth="2" />
      <path d="M15 38c5-1.4 9-1 13 1M15 42.5c5-1.4 9-1 13 1M36 39c4-2 8-2.4 13-1M36 43.5c4-2 8-2.4 13-1" stroke="#9cc2ff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M32 10 13 18.5 32 27l19-8.5z" fill="#fff" />
      <path d="M21 22.5v5.5c0 2.2 5 4 11 4s11-1.8 11-4v-5.5L32 27z" fill="#cfe0ff" />
      <path d="M48 20v8" stroke="#ffc83d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="48" cy="29.5" r="2" fill="#ffc83d" />
    </svg>
  );
}

/** Сипар бо қайд — барои тасмаи «шаффофият» */
export function ShieldCheck({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs><linearGradient id="shield-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3ec8ff" /><stop offset="1" stopColor="#1d5fe8" /></linearGradient></defs>
      <path d="M24 4 7 10v12c0 11 7.3 19.4 17 22 9.7-2.6 17-11 17-22V10z" fill="url(#shield-g)" />
      <path d="M24 7.5 10 12.5v9.7c0 9.2 6 16.4 14 18.6" fill="rgba(255,255,255,.18)" />
      <path d="m16.5 24 5.5 5.5 10-11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
