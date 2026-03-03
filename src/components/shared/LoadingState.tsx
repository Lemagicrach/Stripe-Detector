export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl bg-gray-800/50 h-20" />
      ))}
    </div>
  );
}
