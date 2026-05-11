export default function LoadingEditarProduto() {
  return (
    <div className="mx-auto max-w-lg space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-gray-200" />
        <div className="h-7 w-40 rounded-md bg-gray-200" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-28 rounded bg-gray-200" />
            <div className="h-10 w-full rounded-md bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
