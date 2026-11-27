import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, ChevronRight, ChevronLeft, Check,
  Eye, EyeOff, Loader2, AlertCircle, Search, MapPin,
  Phone, User, Calendar, Briefcase, Mail, Lock, ArrowLeft,
  Hash, Send, ShieldCheck
} from "lucide-react";
import { supabase } from "../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

type AgencyMode = "join" | "create" | null;
type JoinSubMode = "code" | "browse";

type Org = { id: string; name: string; city: string | null; slug: string };

const ROLES = [
  { value: "manager",    label: "Gérant / Directeur" },
  { value: "admin",      label: "Administrateur" },
  { value: "accountant", label: "Comptable" },
  { value: "secretary",  label: "Secrétaire" },
  { value: "member",     label: "Employé / Collaborateur" },
  { value: "viewer",     label: "Observateur" },
];

const STEPS = ["Agence", "Profil", "Compte"];

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
      done  ? "bg-[#075B32] border-[#075B32] text-white" :
      active ? "bg-white border-[#075B32] text-[#075B32]" :
               "bg-white border-[#E2E8E3] text-[#A0ADA5]"
    }`}>
      {done ? <Check size={14} /> : n}
    </div>
  );
}

export function SignupPage() {
  const [step, setStep]               = useState(0);
  const [mode, setMode]               = useState<AgencyMode>(null);
  const [joinSub, setJoinSub]         = useState<JoinSubMode>("code");
  // Code BS
  const [bsCode, setBsCode]           = useState("");
  const [codeOrg, setCodeOrg]         = useState<Org | null>(null);
  const [codeError, setCodeError]     = useState<string | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  // Browse sans code
  const [orgs, setOrgs]               = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgSearch, setOrgSearch]     = useState("");
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  // Nouvelle agence
  const [newOrg, setNewOrg]           = useState({ name: "", city: "", country: "Cameroun", phone: "" });
  // Profil
  const [profile, setProfile]         = useState({ fullName: "", phone: "", gender: "", dob: "", city: "", country: "Cameroun", role: "", bio: "" });
  // Compte
  const [account, setAccount]         = useState({ email: "", password: "", confirm: "" });
  const [showPwd, setShowPwd]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<{ joinType: "code" | "request" | "new" } | null>(null);

  // Charger les agences si mode browse
  useEffect(() => {
    if (mode === "join" && joinSub === "browse" && orgs.length === 0) {
      setOrgsLoading(true);
      supabase.from("organizations").select("id,name,slug,city").order("name")
        .then(({ data }) => { setOrgs(data ?? []); setOrgsLoading(false); });
    }
  }, [mode, joinSub]);

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
    (o.city ?? "").toLowerCase().includes(orgSearch.toLowerCase())
  );

  async function checkCode() {
    const raw = bsCode.trim().toUpperCase();
    if (!raw) return;
    setCodeChecking(true);
    setCodeError(null);
    setCodeOrg(null);
    const { data, error } = await supabase.rpc("lookup_invite_code", { p_code: raw });
    setCodeChecking(false);
    if (error || !data?.length) {
      setCodeError("Code introuvable. Vérifiez le code ou parcourez les agences.");
      return;
    }
    const row = data[0];
    setCodeOrg({ id: row.org_id, name: row.org_name, city: row.org_city, slug: row.org_slug });
  }

  function step1Valid() {
    if (!mode) return false;
    if (mode === "create") return newOrg.name.trim().length >= 2;
    if (joinSub === "code") return !!codeOrg;
    return !!selectedOrg;
  }

  function step2Valid() {
    return profile.fullName.trim().length >= 2 && profile.role !== "";
  }

  function step3Valid() {
    return account.email.includes("@") && account.password.length >= 8 && account.password === account.confirm;
  }

  async function handleSubmit() {
    if (!step3Valid()) return;
    setLoading(true);
    setError(null);

    const joinType = mode === "create" ? "new" : joinSub === "code" ? "code" : "request";
    const orgId = joinSub === "code" ? codeOrg?.id : selectedOrg?.id;

    const metadata: Record<string, string> = {
      full_name:    profile.fullName,
      phone:        profile.phone,
      gender:       profile.gender,
      date_of_birth: profile.dob,
      city:         profile.city,
      country:      profile.country,
      role:         profile.role,
      bio:          profile.bio,
      join_type:    joinType,
      ...(joinType === "code"    ? { invite_code: bsCode.trim().toUpperCase(), organization_id: orgId! } : {}),
      ...(joinType === "request" ? { organization_id: orgId! } : {}),
      ...(joinType === "new"     ? { org_name: newOrg.name, org_city: newOrg.city, org_country: newOrg.country, org_phone: newOrg.phone } : {}),
    };

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: { data: metadata },
    });

    if (signUpErr) { setLoading(false); setError(signUpErr.message); return; }

    // Si session immédiate (pas de confirmation email requise)
    if (signUpData.session) {
      if (joinType === "code") {
        await supabase.rpc("join_org_with_code", { p_code: bsCode.trim().toUpperCase() });
      } else if (joinType === "request" && orgId) {
        await supabase.from("organization_requests").insert({
          organization_id: orgId,
          user_id: signUpData.user!.id,
          full_name: profile.fullName,
          email: account.email,
          role_requested: profile.role,
        });
      }
    }

    setLoading(false);
    setSuccess({ joinType });
  }

  if (success) {
    const msgs: Record<string, { icon: React.ReactNode; title: string; body: string }> = {
      code:    { icon: <ShieldCheck className="w-8 h-8 text-emerald-600" />, title: "Compte créé et agence rejointe !", body: "Vérifiez votre email si nécessaire puis connectez-vous. Votre adhésion est confirmée." },
      request: { icon: <Send className="w-8 h-8 text-blue-500" />, title: "Demande envoyée !", body: `Votre demande a été transmise à l'agence. Vous recevrez une réponse par email une fois traitée.` },
      new:     { icon: <Building2 className="w-8 h-8 text-[#D6A52B]" />, title: "Agence créée !", body: "Votre compte et votre agence sont en cours de configuration. Vérifiez votre email puis connectez-vous." },
    };
    const m = msgs[success.joinType];
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7F5] px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            {m.icon}
          </div>
          <h2 className="text-xl font-bold text-[#17231C] mb-2">{m.title}</h2>
          <p className="text-[#66736A] text-sm mb-6">{m.body}</p>
          <Link to="/connexion" className="inline-flex items-center gap-2 bg-[#075B32] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#063A22] transition-colors">
            Se connecter
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-['Plus_Jakarta_Sans',system-ui,sans-serif]">

      {/* Panneau gauche */}
      <div className="hidden lg:flex lg:w-[40%] bg-[#063A22] flex-col justify-between px-12 py-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D6A52B] flex items-center justify-center">
            <span className="text-[#063A22] font-extrabold text-sm">BS4U</span>
          </div>
          <span className="text-white/70 font-semibold text-sm">Business Starter For You</span>
        </div>
        <div>
          <p className="text-[#D6A52B] text-xs font-bold tracking-widest uppercase mb-4">Rejoindre BS4U</p>
          <h1 className="text-white text-4xl font-bold leading-tight mb-6">
            Lancez votre<br /><span className="text-[#D6A52B]">agence</span> en<br />3 minutes.
          </h1>
          <div className="space-y-3">
            {["Choisissez ou créez votre agence", "Renseignez votre profil", "Accédez à tous les outils"].map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#D6A52B]/20 border border-[#D6A52B]/40 flex items-center justify-center text-[#D6A52B] text-xs font-bold">{i + 1}</div>
                <span className="text-white/70 text-sm">{t}</span>
              </div>
            ))}
          </div>
          {/* Explication du code */}
          <div className="mt-8 bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[#D6A52B] text-xs font-bold mb-2 flex items-center gap-1.5"><Hash size={12} /> Code d'invitation BS</p>
            <p className="text-white/60 text-xs leading-relaxed">
              Chaque agence possède un code unique de type <span className="text-white font-mono">BS-XXXXXX</span>.
              Entrez ce code pour rejoindre instantanément. Sans code, envoyez une demande d'adhésion.
            </p>
          </div>
        </div>
        <p className="text-white/20 text-xs">© 2026 BS4U — Yaoundé, Cameroun</p>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 flex flex-col bg-[#F5F7F5] overflow-y-auto">
        {/* Barre de progression */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8E3]">
          <Link to="/connexion" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#17231C] transition-colors">
            <ArrowLeft size={16} /> Retour
          </Link>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <StepDot n={i + 1} active={step === i} done={step > i} />
                {i < STEPS.length - 1 && <div className={`w-10 h-0.5 transition-colors duration-300 ${step > i ? "bg-[#075B32]" : "bg-[#E2E8E3]"}`} />}
              </div>
            ))}
          </div>
          <span className="text-xs text-[#A0ADA5]">{STEPS[step]}</span>
        </div>

        <div className="flex-1 flex items-start justify-center px-6 py-10">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">

              {/* ───── STEP 0 — Agence ───── */}
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}>
                  <h2 className="text-2xl font-bold text-[#17231C] mb-1">Votre agence</h2>
                  <p className="text-[#66736A] text-sm mb-6">Créez une nouvelle agence ou rejoignez-en une existante.</p>

                  {/* Choix principal */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { key: "create", icon: Building2, title: "Créer une agence", desc: "Nouvelle structure" },
                      { key: "join",   icon: Users,     title: "Rejoindre",         desc: "Agence existante" },
                    ].map(({ key, icon: Icon, title, desc }) => (
                      <button key={key} type="button"
                        onClick={() => { setMode(key as AgencyMode); setCodeOrg(null); setCodeError(null); setSelectedOrg(null); }}
                        className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all ${
                          mode === key ? "border-[#075B32] bg-[#E8F3EC]" : "border-[#E2E8E3] bg-white hover:border-[#075B32]/40"
                        }`}>
                        <Icon className={`w-8 h-8 ${mode === key ? "text-[#075B32]" : "text-[#A0ADA5]"}`} />
                        <div className="text-center">
                          <p className={`text-sm font-semibold ${mode === key ? "text-[#075B32]" : "text-[#17231C]"}`}>{title}</p>
                          <p className="text-xs text-[#A0ADA5]">{desc}</p>
                        </div>
                        {mode === key && <div className="w-5 h-5 rounded-full bg-[#075B32] flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                      </button>
                    ))}
                  </div>

                  {/* ── REJOINDRE ── */}
                  <AnimatePresence>
                    {mode === "join" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4">

                        {/* Onglets Code / Parcourir */}
                        <div className="flex gap-1 bg-[#F5F7F5] rounded-xl p-1">
                          {([["code", "Code d'invitation"], ["browse", "Parcourir"]] as const).map(([k, lbl]) => (
                            <button key={k} type="button"
                              onClick={() => { setJoinSub(k); setCodeOrg(null); setCodeError(null); setSelectedOrg(null); }}
                              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                                joinSub === k ? "bg-white text-[#075B32] shadow-sm" : "text-[#A0ADA5] hover:text-[#17231C]"
                              }`}>
                              {lbl}
                            </button>
                          ))}
                        </div>

                        {/* Code BS */}
                        {joinSub === "code" && (
                          <div className="space-y-3">
                            <div className="relative">
                              <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                              <input
                                value={bsCode}
                                onChange={e => { setBsCode(e.target.value.toUpperCase()); setCodeOrg(null); setCodeError(null); }}
                                onKeyDown={e => e.key === "Enter" && checkCode()}
                                placeholder="BS-XXXXXX"
                                maxLength={9}
                                className="w-full pl-10 pr-4 py-3 font-mono text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 uppercase tracking-widest"
                              />
                            </div>
                            <button type="button" onClick={checkCode} disabled={bsCode.trim().length < 3 || codeChecking}
                              className="w-full flex items-center justify-center gap-2 border-2 border-[#075B32] text-[#075B32] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#E8F3EC] disabled:opacity-50 transition-colors">
                              {codeChecking ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                              {codeChecking ? "Vérification…" : "Vérifier le code"}
                            </button>

                            {/* Résultat code valide */}
                            {codeOrg && (
                              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                <div className="w-10 h-10 rounded-lg bg-[#075B32] flex items-center justify-center text-white font-bold text-sm shrink-0">
                                  {codeOrg.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-emerald-800">{codeOrg.name}</p>
                                  {codeOrg.city && <p className="text-xs text-emerald-600 flex items-center gap-1"><MapPin size={10} />{codeOrg.city}</p>}
                                </div>
                                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                              </motion.div>
                            )}

                            {/* Erreur code */}
                            {codeError && (
                              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                                <AlertCircle size={15} className="shrink-0" /> {codeError}
                              </motion.div>
                            )}

                            <p className="text-center text-xs text-[#A0ADA5]">
                              Pas de code ?{" "}
                              <button type="button" onClick={() => setJoinSub("browse")} className="text-[#075B32] font-semibold hover:underline">
                                Parcourir les agences et envoyer une demande
                              </button>
                            </p>
                          </div>
                        )}

                        {/* Browse (demande) */}
                        {joinSub === "browse" && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                              <Send size={13} className="shrink-0" />
                              Sélectionnez une agence — une <strong>demande d'adhésion</strong> sera envoyée à l'administrateur.
                            </div>
                            <div className="relative">
                              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                              <input value={orgSearch} onChange={e => setOrgSearch(e.target.value)}
                                placeholder="Rechercher une agence…"
                                className="w-full pl-9 pr-3 py-2.5 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                            </div>
                            {orgsLoading ? (
                              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#075B32]" /></div>
                            ) : (
                              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {filteredOrgs.length === 0 && <p className="text-center text-sm text-[#A0ADA5] py-4">Aucune agence trouvée.</p>}
                                {filteredOrgs.map(org => (
                                  <button key={org.id} type="button" onClick={() => setSelectedOrg(org)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                                      selectedOrg?.id === org.id ? "border-[#075B32] bg-[#E8F3EC]" : "border-[#E2E8E3] bg-white hover:border-[#075B32]/40"
                                    }`}>
                                    <div className="w-9 h-9 rounded-lg bg-[#075B32]/10 flex items-center justify-center text-xs font-bold text-[#075B32] shrink-0">
                                      {org.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-[#17231C] truncate">{org.name}</p>
                                      {org.city && <p className="text-xs text-[#A0ADA5] flex items-center gap-1"><MapPin size={10} />{org.city}</p>}
                                    </div>
                                    {selectedOrg?.id === org.id && <Check size={16} className="text-[#075B32] shrink-0" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── CRÉER ── */}
                  <AnimatePresence>
                    {mode === "create" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                        <input value={newOrg.name} onChange={e => setNewOrg(o => ({ ...o, name: e.target.value }))}
                          placeholder="Nom de l'agence *"
                          className="w-full px-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white placeholder:text-[#A0ADA5] focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                        <div className="grid grid-cols-2 gap-3">
                          <input value={newOrg.city} onChange={e => setNewOrg(o => ({ ...o, city: e.target.value }))}
                            placeholder="Ville"
                            className="w-full px-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white placeholder:text-[#A0ADA5] focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                          <input value={newOrg.phone} onChange={e => setNewOrg(o => ({ ...o, phone: e.target.value }))}
                            placeholder="Téléphone"
                            className="w-full px-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white placeholder:text-[#A0ADA5] focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                        </div>
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                          <Hash size={13} className="shrink-0" />
                          Un code <strong>BS-XXXXXX</strong> sera automatiquement généré pour votre agence à la création.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ───── STEP 1 — Profil ───── */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}>
                  <h2 className="text-2xl font-bold text-[#17231C] mb-1">Votre profil</h2>
                  <p className="text-[#66736A] text-sm mb-6">Ces informations apparaîtront dans votre espace de travail.</p>
                  <div className="space-y-4">
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                      <input value={profile.fullName} onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
                        placeholder="Prénom et Nom *"
                        className="w-full pl-10 pr-4 py-3 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                    </div>
                    <div className="relative">
                      <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                      <select value={profile.role} onChange={e => setProfile(p => ({ ...p, role: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 appearance-none">
                        <option value="">Poste de travail *</option>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                      <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                        placeholder="Téléphone" type="tel"
                        className="w-full pl-10 pr-4 py-3 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                        <input value={profile.dob} onChange={e => setProfile(p => ({ ...p, dob: e.target.value }))}
                          type="date"
                          className="w-full pl-10 pr-4 py-3 text-sm border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 text-[#17231C]" />
                      </div>
                      <select value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                        className="w-full px-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 appearance-none">
                        <option value="">Genre</option>
                        <option value="male">Homme</option>
                        <option value="female">Femme</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={profile.city} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
                        placeholder="Ville"
                        className="w-full px-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white placeholder:text-[#A0ADA5] focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                      <input value={profile.country} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))}
                        placeholder="Pays"
                        className="w-full px-4 py-3 text-sm text-[#17231C] border border-[#E2E8E3] rounded-xl bg-white placeholder:text-[#A0ADA5] focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                    </div>
                    <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Bio courte (optionnel)" rows={2}
                      className="w-full px-4 py-3 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 resize-none" />
                  </div>
                </motion.div>
              )}

              {/* ───── STEP 2 — Compte ───── */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}>
                  <h2 className="text-2xl font-bold text-[#17231C] mb-1">Vos identifiants</h2>
                  <p className="text-[#66736A] text-sm mb-6">Choisissez un email et un mot de passe sécurisé (8 caractères min.).</p>
                  <div className="space-y-4">
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                      <input value={account.email} onChange={e => setAccount(a => ({ ...a, email: e.target.value }))}
                        type="email" placeholder="Adresse email *"
                        className="w-full pl-10 pr-4 py-3 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                      <input value={account.password} onChange={e => setAccount(a => ({ ...a, password: e.target.value }))}
                        type={showPwd ? "text" : "password"} placeholder="Mot de passe *"
                        className="w-full pl-10 pr-10 py-3 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5] hover:text-[#075B32]">
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
                      <input value={account.confirm} onChange={e => setAccount(a => ({ ...a, confirm: e.target.value }))}
                        type={showPwd ? "text" : "password"} placeholder="Confirmer le mot de passe *"
                        className={`w-full pl-10 pr-4 py-3 text-sm text-[#17231C] placeholder:text-[#A0ADA5] border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#075B32]/20 ${
                          account.confirm && account.confirm !== account.password ? "border-red-400" : "border-[#E2E8E3] focus:border-[#075B32]"
                        }`} />
                    </div>
                    {account.confirm && account.confirm !== account.password && (
                      <p className="text-red-500 text-xs">Les mots de passe ne correspondent pas.</p>
                    )}

                    {/* Récap */}
                    <div className="bg-[#E8F3EC] rounded-xl p-4 space-y-1.5">
                      <p className="text-xs font-bold text-[#075B32] mb-2">Récapitulatif</p>
                      <p className="text-xs text-[#17231C]">
                        <span className="text-[#66736A]">Agence :</span>{" "}
                        {mode === "create" ? `${newOrg.name} (nouvelle — code BS généré automatiquement)` :
                         joinSub === "code" ? `${codeOrg?.name} (adhésion directe via code)` :
                         `${selectedOrg?.name} (demande d'adhésion)`}
                      </p>
                      <p className="text-xs text-[#17231C]"><span className="text-[#66736A]">Nom :</span> {profile.fullName}</p>
                      <p className="text-xs text-[#17231C]"><span className="text-[#66736A]">Poste :</span>{" "}{ROLES.find(r => r.value === profile.role)?.label}</p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                        <AlertCircle size={16} className="shrink-0" /> {error}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button type="button" onClick={() => { setError(null); setStep(s => s - 1); }} disabled={step === 0}
                className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#17231C] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-4 py-2 rounded-xl hover:bg-white">
                <ChevronLeft size={16} /> Précédent
              </button>
              {step < 2 ? (
                <button type="button" onClick={() => { setError(null); setStep(s => s + 1); }}
                  disabled={step === 0 ? !step1Valid() : !step2Valid()}
                  className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
                  Suivant <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={!step3Valid() || loading}
                  className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {loading ? "Création…" : "Créer mon compte"}
                </button>
              )}
            </div>

            <p className="text-center text-xs text-[#A0ADA5] mt-6">
              Déjà un compte ?{" "}
              <Link to="/connexion" className="text-[#075B32] font-semibold hover:underline">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
