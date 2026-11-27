export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#063A22] z-50"
      role="status"
      aria-label="Chargement de l'application"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Logo simplifié */}
        <div className="w-16 h-16 rounded-full bg-[#D6A52B] flex items-center justify-center animate-pulse">
          <span className="text-[#063A22] font-bold text-xl">BS4U</span>
        </div>
        {/* Spinner */}
        <div className="w-8 h-8 border-2 border-[#D6A52B]/30 border-t-[#D6A52B] rounded-full animate-spin" />
        <p className="text-[#9AA79F] text-sm">Chargement…</p>
      </div>
    </div>
  );
}
