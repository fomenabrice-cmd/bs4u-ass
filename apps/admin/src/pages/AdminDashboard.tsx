import { motion } from "framer-motion";
import { Users, Shield, FileSearch, AlertTriangle, Activity, TrendingUp, CheckCircle2, XCircle } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

const stats = [
  {
    label: "Utilisateurs actifs",
    value: "24",
    sub: "+3 ce mois",
    icon: Users,
    accent: "#075B32",
    bg: "#E8F3EC",
    iconColor: "#075B32",
    trend: "+14%",
    up: true,
  },
  {
    label: "Rôles définis",
    value: "29",
    sub: "5 domaines",
    icon: Shield,
    accent: "#1E40AF",
    bg: "#EFF6FF",
    iconColor: "#1D4ED8",
    trend: "stable",
    up: null,
  },
  {
    label: "Événements audit",
    value: "1 847",
    sub: "30 derniers jours",
    icon: FileSearch,
    accent: "#6D28D9",
    bg: "#F5F3FF",
    iconColor: "#7C3AED",
    trend: "+6%",
    up: true,
  },
  {
    label: "Alertes sécurité",
    value: "2",
    sub: "À traiter",
    icon: AlertTriangle,
    accent: "#B91C1C",
    bg: "#FEF2F2",
    iconColor: "#DC2626",
    trend: "urgence",
    up: false,
  },
];

const recentAudit = [
  { action: "user.login",         actor: "admin@bs4u.cm",    entity: "auth",            time: "il y a 5 min",  ok: true  },
  { action: "role.permission.add",actor: "admin@bs4u.cm",    entity: "biz_manager",     time: "il y a 1h",     ok: true  },
  { action: "user.login.failed",  actor: "unknown",           entity: "auth",            time: "il y a 2h",     ok: false },
  { action: "settings.updated",   actor: "admin@bs4u.cm",    entity: "system_settings", time: "il y a 3h",     ok: true  },
  { action: "user.created",       actor: "admin@bs4u.cm",    entity: "core.persons",    time: "hier",          ok: true  },
];

export function AdminDashboard() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">

      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <h1 className="text-2xl font-bold text-[#17231C]">Administration</h1>
        <p className="text-sm text-[#66736A] mt-0.5">Vue d'ensemble du système BS4U</p>
      </motion.div>

      {/* KPI cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map(({ label, value, sub, icon: Icon, bg, iconColor, trend, up }) => (
          <motion.div
            key={label}
            variants={item}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="rounded-2xl p-5 shadow-sm border border-black/5 cursor-default"
            style={{ backgroundColor: bg }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${iconColor}18` }}
              >
                <Icon size={18} style={{ color: iconColor }} />
              </div>
              {up !== null && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: up ? "#D1FAE5" : "#FEE2E2",
                    color: up ? "#065F46" : "#991B1B",
                  }}
                >
                  {trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#17231C] tabular-nums">{value}</p>
            <p className="text-xs text-[#66736A] mt-0.5">{label}</p>
            <p className="text-xs font-medium mt-1" style={{ color: iconColor }}>{sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Audit récent */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.3 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] overflow-hidden shadow-sm"
      >
        <div className="px-6 py-4 border-b border-[#E2E8E3] flex items-center gap-2">
          <Activity size={16} className="text-[#66736A]" />
          <h2 className="text-sm font-semibold text-[#17231C]">Activité récente</h2>
          <span className="ml-auto text-xs text-[#66736A] flex items-center gap-1">
            <TrendingUp size={12} />
            {recentAudit.length} événements
          </span>
        </div>
        <div className="divide-y divide-[#F5F7F5]">
          {recentAudit.map((e, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease, delay: 0.35 + i * 0.06 }}
              className="px-6 py-3.5 flex items-center gap-4 hover:bg-[#F5F7F5] transition-colors"
            >
              {e.ok
                ? <CheckCircle2 size={16} className="text-[#067647] shrink-0" />
                : <XCircle size={16} className="text-[#B42318] shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium text-[#17231C]">{e.action}</p>
                <p className="text-xs text-[#66736A] truncate mt-0.5">
                  {e.actor}
                  <span className="mx-1.5 text-[#E2E8E3]">·</span>
                  {e.entity}
                </p>
              </div>
              <span className="text-xs text-[#A0ADA5] shrink-0 whitespace-nowrap">{e.time}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
