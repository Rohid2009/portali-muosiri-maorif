/** Тасвири саҳифаи асосӣ: дафтари кушодаи журнал бо баҳоҳо (SVG, бе файлҳои беруна) */
export function NotebookArt() {
  const rows = ['Аҳмадов Ф.', 'Боқиева М.', 'Валиев С.', 'Ғафорова Н.', 'Давлатов И.', 'Зоирова Ш.'];
  const marks: [number, number, string][] = [
    [0, 0, '8'], [0, 1, '9'], [0, 2, '10'], [1, 0, '7'], [1, 2, '9'], [2, 1, '8'],
    [3, 0, '9'], [3, 1, '10'], [4, 0, 'н'], [4, 2, '7'], [5, 0, '10'], [5, 1, '9'],
  ];
  return (
    <svg viewBox="0 0 560 420" className="h-auto w-full max-w-[560px] drop-shadow-[0_30px_40px_rgba(0,0,0,.28)]" role="img" aria-label="Дафтари кушодаи журнал">
      <defs>
        <pattern id="nb-sq" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M14 0H0v14" fill="none" stroke="#c9dcf0" strokeWidth=".8" />
        </pattern>
        <linearGradient id="nb-pg" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#f1f6fc" />
        </linearGradient>
      </defs>
      <path d="M40 70 280 52v330L40 398z" fill="#083a66" />
      <path d="M520 70 280 52v330l240 16z" fill="#083a66" />
      {['M52 62 276 44v326L52 386z', 'M508 62 284 44v326l224 16z'].map((d) => (
        <g key={d}><path d={d} fill="url(#nb-pg)" /><path d={d} fill="url(#nb-sq)" /></g>
      ))}
      <path d="M276 44h8v326h-8z" fill="#d6e4f3" />
      <text x="74" y="100" fontSize="15" fontWeight="700" fill="#0b4f8a">Математика · 8-Г</text>
      {rows.map((r, i) => (
        <g key={r}>
          <text x="74" y={140 + i * 36} fontSize="12.5" fill="#33475e">{r}</text>
          {i < 5 && <path d={`M70 ${152 + i * 36}h190`} stroke="#c9dcf0" />}
        </g>
      ))}
      {marks.map(([r, c, v]) => (
        <text key={`${r}-${c}`} x={168 + c * 32} y={141 + r * 36} fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize={v === 'н' ? 17 : 21} fill="#c0262d">{v}</text>
      ))}
      <g transform="translate(306 92)">
        <rect width="180" height="112" rx="12" fill="#0b4f8a" />
        <text x="16" y="30" fontSize="12" fill="#cfe2f5">Чоряки 2 · баҳои миёна</text>
        <text x="16" y="78" fontSize="44" fontWeight="800" fill="#fff">7.8</text>
        <path d="M110 80l14-18 14 8 14-22 14 10" fill="none" stroke="#e9a822" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(306 226)">
        <rect width="180" height="46" rx="10" fill="#dcfce7" />
        <text x="14" y="29" fontSize="13" fontWeight="700" fill="#15803d">Давомот 94%</text>
        <rect y="58" width="180" height="46" rx="10" fill="#fff6e0" />
        <text x="14" y="87" fontSize="13" fontWeight="700" fill="#8a5d00">Дархостҳои тасҳеҳ</text>
      </g>
      <g transform="rotate(-28 470 330)">
        <rect x="400" y="322" width="150" height="16" rx="3" fill="#e9a822" />
        <path d="M550 322l22 8-22 8z" fill="#f3d9a6" />
        <path d="M566 328l6 2-6 2z" fill="#3b2800" />
        <rect x="392" y="322" width="12" height="16" rx="2" fill="#c0262d" />
      </g>
    </svg>
  );
}
