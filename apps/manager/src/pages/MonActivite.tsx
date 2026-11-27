import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, FileText, Printer } from "lucide-react";
import { supabase } from "../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("fr-CM", { day: "2-digit", month: "long" });
}

interface WeekStats {
  ordersCount: number;
  docsCount: number;
  printCount: number;
}

export function MonActivite() {
  const [stats, setStats] = useState<WeekStats>({ ordersCount: 0, docsCount: 0, printCount: 0 });
  const { start, end } = getWeekBounds();

  useEffect(() => {
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    Promise.all([
      supabase.from("v_orders").select("id", { count: "exact", head: true })
        .gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("v_documents").select("id", { count: "exact", head: true })
        .gte("created_at", startIso).lte("created_at", endIso),
      supabase.from("v_print_queue").select("id", { count: "exact", head: true }),
    ]).then(([orders, docs, print]) => {
      setStats({
        ordersCount: orders.count ?? 0,
        docsCount: docs.count ?? 0,
        printCount: print.count ?? 0,
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const KPI = [
    { label: "Commandes traitées",  value: String(stats.ordersCount), sub: "cette semaine",     icon: ShoppingCart, color: "#075B32", bg: "#E8F3EC" },
    { label: "Documents créés",     value: String(stats.docsCount),   sub: "secrétariat",       icon: FileText,     color: "#1E40AF", bg: "#EFF6FF" },
    { label: "Travaux impression",  value: String(stats.printCount),  sub: "en file d'attente", icon: Printer,      color: "#6D28D9", bg: "#F5F3FF" },
  ];

  const weekLabel = `Semaine du ${fmtDate(start)} au ${fmtDate(end)} ${end.getFullYear()}`;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
        <h1 className="text-2xl font-bold text-[#17231C]">Mon activité</h1>
        <p className="text-sm text-[#66736A] mt-0.5">{weekLabel}</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {KPI.map(({ label, value, sub, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5"
            style={{ backgroundColor: bg }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color }}>{sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
