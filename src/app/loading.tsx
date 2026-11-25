// Ҳангоми «бедоршавии» сервери ройгон (cold start) ин нишон дода мешавад.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-slate-600" role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
      <p>Боргирӣ… Лутфан чанд сония интизор шавед.</p>
    </div>
  );
}
