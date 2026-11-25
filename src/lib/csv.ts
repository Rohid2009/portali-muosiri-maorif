// Содирот ба CSV. Excel онро бевосита мекушояд (BOM барои ҳарфҳои тоҷикӣ, ҷудокунанда «;»).
type Cell = string | number | null | undefined;

function esc(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Ҳимоя аз CSV-injection дар Excel
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

export function csvResponse(filename: string, rows: readonly (readonly Cell[])[]): Response {
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.csv`,
      'Cache-Control': 'no-store',
    },
  });
}
