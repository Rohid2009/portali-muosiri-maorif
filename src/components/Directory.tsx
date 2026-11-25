'use client';

import { useMemo, useState } from 'react';

export type DirectoryItem = {
  id: number;
  name: string;
  lines: string[];         // масалан: «Математика — 7-А, 8-Г» ё «Фарзанд: Мадина Б., 8-Г»
  phone: string | null;    // "992901234567" ё null (пинҳон)
  highlight?: boolean;     // масалан: омӯзгори синфи фарзанди шумо
  chatHref?: string;       // пайванд ба чат
};

const norm = (s: string) => s.toLocaleLowerCase('tg').replace(/ё/g, 'е');
const fmt = (p: string) => (p.length === 12 ? `+${p.slice(0, 3)} ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8)}` : p);

/** Оё ягон калимаи ном бо матни ҷустуҷӯ сар мешавад (ё матн дар ном ҳаст) */
function matches(name: string, q: string): 0 | 1 | 2 {
  if (!q) return 1;
  const n = norm(name);
  const words = n.split(/\s+/);
  if (words.some((w) => w.startsWith(q)) || n.startsWith(q)) return 2;
  return n.includes(q) ? 1 : 0;
}

/** Рӯйхати тамос бо ҷустуҷӯ, пешниҳоди номҳо аз ҳарфи аввал ва филтри алифбо */
export function Directory({ items, placeholder }: { items: DirectoryItem[]; placeholder: string }) {
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState('');
  const [open, setOpen] = useState(false);
  const nq = norm(q.trim());

  const letters = useMemo(
    () => [...new Set(items.map((i) => i.name.trim()[0]?.toLocaleUpperCase('tg')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')),
    [items],
  );

  const shown = useMemo(() => {
    return items
      .map((i) => ({ i, m: matches(i.name, nq) }))
      .filter(({ i, m }) => m > 0 && (!letter || i.name.trim().toLocaleUpperCase('tg').startsWith(letter)))
      .sort((a, b) => b.m - a.m || Number(!!b.i.highlight) - Number(!!a.i.highlight) || a.i.name.localeCompare(b.i.name, 'ru'))
      .map(({ i }) => i);
  }, [items, nq, letter]);

  const suggestions = nq ? shown.filter((i) => matches(i.name, nq) === 2).slice(0, 6) : [];

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="input pl-11 text-base"
          aria-label={placeholder}
          aria-autocomplete="list"
          autoComplete="off"
        />
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        {open && suggestions.length > 0 && (
          <ul role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {suggestions.map((s) => {
              const n = s.name;
              const idx = norm(n).split(/\s+/).findIndex((w) => w.startsWith(nq));
              const words = n.split(/\s+/);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQ(n); setOpen(false); }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-light"
                  >
                    <span>
                      {words.map((w, k) => (
                        <span key={k}>
                          {k > 0 && ' '}
                          {k === idx ? <><b className="text-brand">{w.slice(0, nq.length)}</b>{w.slice(nq.length)}</> : w}
                        </span>
                      ))}
                    </span>
                    <span className="truncate text-xs text-slate-500">{s.lines[0]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {letters.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Аз рӯи ҳарфи аввал">
          <button type="button" onClick={() => setLetter('')} className={`h-9 min-w-9 rounded-lg px-2.5 text-sm font-semibold ${!letter ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-light'}`}>Ҳама</button>
          {letters.map((l) => (
            <button key={l} type="button" onClick={() => setLetter(l === letter ? '' : l)} aria-pressed={l === letter}
              className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${l === letter ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-light'}`}>{l}</button>
          ))}
        </div>
      )}

      <p className="mt-4 text-[13px] text-slate-500">{shown.length} аз {items.length}</p>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-slate-500">Ёфт нашуд.</p>
      ) : (
        <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {shown.map((i) => (
            <li key={i.id} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${i.highlight ? 'border-brand/40 bg-brand-light/60' : 'border-slate-200'}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-light text-sm font-bold text-brand">
                {i.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block truncate">{i.name}</b>
                {i.lines.map((l) => <span key={l} className="block truncate text-[13px] text-slate-500">{l}</span>)}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {i.phone ? (
                  <a href={`tel:+${i.phone}`} className="rounded-xl bg-green-100 px-3 py-1.5 text-sm font-semibold tabular-nums text-green-800 hover:bg-green-200">
                    {fmt(i.phone)}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">рақам пинҳон</span>
                )}
                {i.chatHref && (
                  <a href={i.chatHref} className="rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">Навиштан</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
