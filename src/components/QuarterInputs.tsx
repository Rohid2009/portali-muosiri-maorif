/** Майдонҳои санаи 4 чоряк (барои сохтани сол) */
export function QuarterInputs() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1, 2, 3, 4].map((n) => (
        <fieldset key={n} className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold">Чоряки {n}</legend>
          <div className="flex gap-2">
            <label className="label flex-1">Оғоз<input type="date" name={`q${n}s`} className="input" required /></label>
            <label className="label flex-1">Анҷом<input type="date" name={`q${n}e`} className="input" required /></label>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
