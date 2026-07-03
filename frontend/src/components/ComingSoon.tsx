// ============================================================
//  ComingSoon : placeholder pour les écrans admin pas encore
//  construits (remplis dans les phases 8.2 → 8.5).
// ============================================================
export function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">{title}</h1>
      <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
        Écran en cours de construction.
      </div>
    </div>
  )
}
