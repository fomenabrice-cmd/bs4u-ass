import { motion } from "framer-motion";
import { FileText, CreditCard, BookOpen, User, CheckCircle2, Bell, CalendarDays, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const ease = [0.22, 1, 0.36, 1] as const;

const quickLinks = [
  { to: "/profil",     icon: User,       label: "Mon profil",    desc: "Mettre à jour mes informations" },
  { to: "/adhesion",   icon: CreditCard, label: "Mon adhésion",  desc: "Statut et cotisations"           },
  { to: "/documents",  icon: FileText,   label: "Mes documents", desc: "Attestations et certificats"     },
  { to: "/formations", icon: BookOpen,   label: "Formations",    desc: "Mes cours et certificats"        },
];

const announcements = [
  {
    color: "blue",
    icon: CalendarDays,
    title: "Assemblée générale — 15 décembre 2026",
    body:  "Salle principale BS4U, 10h00. Présence obligatoire.",
    bg: "#EFF6FF", border: "#BFDBFE", titleColor: "#1E40AF", bodyColor: "#2563EB",
  },
  {
    color: "amber",
    icon: Bell,
    title: "Formation « Fiscalité PME » — Places limitées",
    body:  "Inscrivez-vous avant le 30 novembre.",
    bg: "#FFFBEB", border: "#FDE68A", titleColor: "#92400E", bodyColor: "#B45309",
  },
];

export function MemberDashboard() {
  return (
    <div className="min-h-screen" style={{ background: "#F5F7F5" }}>

      {/* Hero */}
      <div
        className="relative overflow-hidden px-6 py-10 text-white"
        style={{ background: "linear-gradient(135deg, #063A22 0%, #075B32 60%, #0A6B3C 100%)" }}
      >
        {/* Pattern */}
        <svg
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 opacity-10"
          width="200" height="200" viewBox="0 0 200 200"
        >
          <circle cx="150" cy="50"  r="80" fill="#D6A52B" />
          <circle cx="180" cy="150" r="50" fill="#D6A52B" />
        </svg>

        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="text-xs font-mono text-emerald-300 mb-2 tracking-widest"
        >
          MBR-2026-000042
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.05 }}
          className="text-2xl font-bold mb-1"
        >
          Bonjour, Jean-Paul 👋
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-emerald-300 text-sm"
        >
          Membre standard
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.15 }}
          className="mt-5 flex flex-wrap gap-2"
        >
          <div className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5"
               style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
            <CheckCircle2 size={14} />
            <span className="text-sm font-semibold">Actif</span>
          </div>
          <div className="rounded-xl px-3.5 py-2.5"
               style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
            <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Membre depuis</p>
            <p className="text-sm font-semibold">15 mars 2024</p>
          </div>
          <div className="rounded-xl px-3.5 py-2.5"
               style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
            <p className="text-[10px] text-emerald-300 uppercase tracking-widest">Cotisation 2026</p>
            <p className="text-sm font-semibold" style={{ color: "#D6A52B" }}>15 000 FCFA — Payée</p>
          </div>
        </motion.div>
      </div>

      {/* Quick links */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map(({ to, icon: Icon, label, desc }, i) => (
            <motion.div
              key={to}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: 0.2 + i * 0.07 }}
            >
              <Link
                to={to}
                className="group flex flex-col h-full bg-white rounded-2xl border p-4 shadow-sm
                           hover:shadow-md hover:border-[#075B32]/30 transition-all"
                style={{ borderColor: "#E2E8E3" }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors"
                     style={{ background: "#E8F3EC" }}>
                  <Icon size={18} style={{ color: "#075B32" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "#17231C" }}>{label}</p>
                <p className="text-xs mt-0.5 flex-1" style={{ color: "#66736A" }}>{desc}</p>
                <ChevronRight size={14} className="mt-2 self-end opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: "#075B32" }} />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Annonces */}
      <div className="px-4 mt-6 pb-8 space-y-3">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm font-semibold mb-3"
          style={{ color: "#17231C" }}
        >
          Annonces
        </motion.h2>
        {announcements.map(({ title, body, bg, border, titleColor, bodyColor, icon: Icon }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.55 + i * 0.08 }}
            className="rounded-2xl p-4 border flex gap-3"
            style={{ background: bg, borderColor: border }}
          >
            <Icon size={16} className="mt-0.5 shrink-0" style={{ color: titleColor }} />
            <div>
              <p className="text-sm font-medium" style={{ color: titleColor }}>{title}</p>
              <p className="text-xs mt-1" style={{ color: bodyColor }}>{body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
