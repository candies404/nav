export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="页面加载中">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted/60" />
        ))}
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <div className="h-10 animate-pulse rounded-md bg-muted/70" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-md bg-muted/50" />
        ))}
      </div>
    </div>
  )
}
