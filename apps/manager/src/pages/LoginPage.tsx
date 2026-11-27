import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, AlertCircle, Loader2, Zap, Eye, EyeOff, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";


const TEST_ACCOUNT = { label: "Compte test", role: "Agence BS4U", email: "test.agence.bs4u@gmail.com", password: "TestBS4U2024!", color: "#075B32", bg: "#E8F3EC" };

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease, delay: i * 0.08 },
  }),
};

export function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [supaStatus, setSupaStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const navigate = useNavigate();

  const checkSupabase = async () => {
    setSupaStatus("checking");
    try {
      const { error } = await supabase.auth.getSession();
      setSupaStatus(error ? "error" : "ok");
    } catch {
      setSupaStatus("error");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const demo = null;
    if (demo) {
      navigate("/");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Identifiants incorrects. Vérifiez votre email et mot de passe.");
      setLoading(false);
      return;
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-['Plus_Jakarta_Sans',system-ui,sans-serif]">

      {/* ── Panneau gauche — identité de marque ── */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease }}
        className="relative lg:w-[52%] flex flex-col justify-between overflow-hidden
                   bg-[#063A22] px-10 py-12 lg:px-16 lg:py-16"
        style={{ minHeight: "100svh" }}
      >
        {/* Motif décoratif — grille verte subtile */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(7,91,50,0.6) 0%, transparent 60%)," +
              "radial-gradient(circle at 80% 80%, rgba(214,165,43,0.08) 0%, transparent 50%)",
          }}
        />
        {/* Lignes de grille */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#D6A52B" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.1 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-[#D6A52B] flex items-center justify-center shadow-lg">
            <span className="text-[#063A22] font-extrabold text-sm tracking-tight">BS4U</span>
          </div>
          <span className="text-white/80 font-semibold text-sm tracking-wide">Business Starter For You</span>
        </motion.div>

        {/* Accroche centrale */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-16 lg:py-0">
          <motion.p
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-[#D6A52B] text-sm font-semibold tracking-widest uppercase mb-6"
          >
            Espace de travail
          </motion.p>
          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-white text-4xl lg:text-5xl font-bold leading-tight"
          >
            Gérez votre<br />
            <span className="text-[#D6A52B]">activité</span> au<br />
            quotidien.
          </motion.h1>
          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 text-white/50 text-base leading-relaxed max-w-sm"
          >
            Clients, paiements, documents, Mobile Money —
            tout en un seul tableau de bord.
          </motion.p>

          {/* Métriques flottantes */}
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-10 flex flex-wrap gap-4"
          >
            {[
              { n: "5 apps",    l: "Modules intégrés" },
              { n: "XAF",       l: "Monnaie locale" },
              { n: "MoMo",      l: "Paiement mobile" },
            ].map(({ n, l }) => (
              <div
                key={n}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm
                           px-5 py-3 flex flex-col gap-0.5"
              >
                <span className="text-[#D6A52B] font-bold text-lg">{n}</span>
                <span className="text-white/40 text-xs">{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Tagline pied de page */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="relative z-10 text-white text-xs"
        >
          © 2026 BS4U — Yaoundé, Cameroun
        </motion.p>
      </motion.div>

      {/* ── Panneau droit — formulaire ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1 flex items-center justify-center bg-[#F5F7F5] px-6 py-16 lg:px-16"
      >
        <div className="w-full max-w-sm">

          {/* Titre formulaire */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-8">
            <h2 className="text-[#17231C] text-2xl font-bold">Connexion</h2>
            <p className="text-[#66736A] text-sm mt-1">Accédez à votre espace BS4U Manager</p>
          </motion.div>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* Erreur */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  role="alert"
                  className="flex items-start gap-3 bg-red-50 border border-red-200
                             text-[#B42318] text-sm rounded-xl px-4 py-3 overflow-hidden"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
              <label htmlFor="email" className="block text-xs font-semibold text-[#17231C] mb-2 tracking-wide uppercase">
                Adresse email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#66736A]" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2E8E3]
                             bg-white text-[#17231C] text-sm placeholder:text-[#A0ADA5]
                             transition-shadow duration-200
                             focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
                  placeholder="votre@email.cm"
                />
              </div>
            </motion.div>

            {/* Mot de passe */}
            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-[#17231C] tracking-wide uppercase">
                  Mot de passe
                </label>
                <a href="#" className="text-xs text-[#075B32] hover:text-[#063A22] transition-colors font-medium">
                  Oublié ?
                </a>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#66736A]" />
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E2E8E3]
                             bg-white text-[#17231C] text-sm placeholder:text-[#A0ADA5]
                             transition-shadow duration-200
                             focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#66736A] hover:text-[#075B32] transition-colors">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </motion.div>

            {/* Bouton de connexion */}
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.015 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="w-full flex items-center justify-center gap-2
                           bg-[#075B32] hover:bg-[#063A22] active:bg-[#052E1B]
                           text-white py-3.5 rounded-xl text-sm font-semibold
                           transition-colors duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed shadow-sm
                           shadow-[#075B32]/30"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Se connecter
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </motion.div>
          </form>

          {/* Toggle login / signup */}
          <motion.p custom={4} variants={fadeUp} initial="hidden" animate="show" className="text-center text-xs text-[#A0ADA5] mt-5">
            Pas encore de compte ?{" "}
            <Link to="/inscription" className="text-[#075B32] font-semibold hover:underline">Créer un compte</Link>
          </motion.p>

          {/* Compte test */}
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show" className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-[#E2E8E3]" />
              <span className="text-[10px] font-semibold tracking-widest text-[#A0ADA5] uppercase flex items-center gap-1">
                <Zap size={10} />
                Compte test
              </span>
              <div className="flex-1 h-px bg-[#E2E8E3]" />
            </div>
            <motion.button
              type="button"
              onClick={() => { setEmail(TEST_ACCOUNT.email); setPassword(TEST_ACCOUNT.password); setError(null); }}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-full rounded-xl border py-2.5 px-4 text-center transition-shadow hover:shadow-sm"
              style={{ background: TEST_ACCOUNT.bg, borderColor: `${TEST_ACCOUNT.color}30` }}
              title={`Pré-remplir avec le compte test — ${TEST_ACCOUNT.email}`}
            >
              <p className="text-xs font-bold" style={{ color: TEST_ACCOUNT.color }}>{TEST_ACCOUNT.label}</p>
              <p className="text-[9px] mt-0.5" style={{ color: `${TEST_ACCOUNT.color}99` }}>{TEST_ACCOUNT.role}</p>
            </motion.button>
            <p className="text-center text-[#A0ADA5] text-[10px] mt-2">
              Cliquez pour pré-remplir, puis « Se connecter »
            </p>
          </motion.div>

          {/* Test connexion Supabase */}
          <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show" className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={checkSupabase}
              disabled={supaStatus === "checking"}
              className="flex items-center gap-1.5 text-[10px] text-[#A0ADA5] hover:text-[#17231C]
                         border border-[#E2E8E3] hover:border-[#A0ADA5] rounded-lg px-3 py-1.5
                         transition-colors duration-150 disabled:opacity-50"
            >
              {supaStatus === "checking" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : supaStatus === "ok" ? (
                <CheckCircle2 size={11} className="text-[#067647]" />
              ) : supaStatus === "error" ? (
                <WifiOff size={11} className="text-[#B42318]" />
              ) : (
                <Wifi size={11} />
              )}
              {supaStatus === "idle"     && "Tester la connexion Supabase"}
              {supaStatus === "checking" && "Vérification…"}
              {supaStatus === "ok"       && "Supabase connecté"}
              {supaStatus === "error"    && "Supabase inaccessible"}
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-center text-[#A0ADA5] text-xs mt-4"
          >
            « Vos idées, nos solutions, votre réussite. »
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
