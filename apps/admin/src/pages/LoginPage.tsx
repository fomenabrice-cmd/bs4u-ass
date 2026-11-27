import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [mode, setMode]           = useState<"login" | "signup">("login");
  const [fullName, setFullName]   = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setError(null);
      setMode("login");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#063A22] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-full bg-[#D6A52B] items-center justify-center mb-4">
            <span className="text-[#063A22] font-bold text-xl">BS4U</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">BS4U Admin</h1>
          <p className="text-[#9AA79F] text-sm mt-1">
            {mode === "login" ? "Accès réservé aux administrateurs plateforme" : "Créer un compte administrateur"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {mode === "signup" && (
            <input id="fullName" type="text" required placeholder="Nom complet"
              value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          )}
          <input id="email" type="email" required placeholder="Email administrateur"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none"
          />
          <div className="relative">
            <input id="password" type={showPwd ? "text" : "password"} required placeholder="Mot de passe"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA79F] hover:text-[#075B32]">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          {mode === "signup" && <p className="text-emerald-600 text-xs hidden" id="signup-ok">Compte créé ! Connectez-vous.</p>}
          <button type="submit" disabled={loading} className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#063A22] disabled:opacity-60">
            {loading ? "…" : mode === "login" ? "Se connecter" : "Créer le compte"}
          </button>
          <p className="text-center text-xs text-slate-500">
            {mode === "login" ? (
              <>Pas encore de compte ?{" "}<button type="button" onClick={() => { setMode("signup"); setError(null); }} className="text-[#075B32] font-medium hover:underline">Créer un compte</button></>
            ) : (
              <>Déjà un compte ?{" "}<button type="button" onClick={() => { setMode("login"); setError(null); }} className="text-[#075B32] font-medium hover:underline">Se connecter</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
