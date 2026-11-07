/** Shown instantly on navigation while a page loads from Google Sheets. */
export default function Loading() {
  const block = "animate-pulse rounded-xl border border-line bg-surface";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface-2" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className={`${block} h-28 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`} />)}
        </div>
        <div className={`${block} h-72`} />
        <div className={`${block} h-48`} />
      </div>
    </div>
  );
}
