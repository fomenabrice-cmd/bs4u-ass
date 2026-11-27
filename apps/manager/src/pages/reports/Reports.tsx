import { useState, useEffect } from "react";
import { BarChart2, TrendingUp, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../../lib/supabase";

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

interface MonthStat { mois: string; recettes: number; commandes: number }

export function Reports() {
  const [monthlyData, setMonthlyData] = useState<MonthStat[]>([]);

  useEffect(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    supabase
      .from("v_orders")
      .select("id, total_xaf, created_at")
      .gte("created_at", sixMonthsAgo.toISOString())
      .then(({ data }) => {
        // Build 6-month buckets
        const map: Record<string, MonthStat> = {};
        for (let i = 0; i < 6; i++) {
          const d = new Date();
          d.setMonth(d.getMonth() - 5 + i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          map[key] = { mois: MONTHS_FR[d.getMonth()], recettes: 0, commandes: 0 };
        }
        for (const o of data ?? []) {
          const key = (o.created_at as string).slice(0, 7);
          if (map[key]) { map[key].recettes += (o.total_xaf as number) ?? 0; map[key].commandes++; }
        }
        setMonthlyData(Object.values(map));
      });
  }, []);

  const totalRevenue = monthlyData.reduce((s, m) => s + m.recettes, 0);
  const totalOrders  = monthlyData.reduce((s, m) => s + m.commandes, 0);
  const currentMonth = new Date().toLocaleString("fr-CM", { month: "long", year: "numeric" });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#E8F3EC] flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-[#075B32]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Rapports & Analytique</h1>
          <p className="text-sm text-[#66736A]">{currentMonth}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
          <p className="text-xs text-[#66736A] mb-1">CA 6 derniers mois</p>
          <p className="text-xl font-bold text-[#17231C] tabular-nums">{fmt(totalRevenue)} FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
          <p className="text-xs text-[#66736A] mb-1">Commandes 6 derniers mois</p>
          <p className="text-xl font-bold text-[#175CD3] tabular-nums">{totalOrders}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#17231C]">Recettes mensuelles (FCFA)</h2>
          <TrendingUp className="w-4 h-4 text-[#075B32]" />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E3" vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 12, fill: "#66736A" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmt(v as number)} tick={{ fontSize: 11, fill: "#66736A" }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [fmt(v as number) + " FCFA", "Recettes"]}
              contentStyle={{ border: "1px solid #E2E8E3", borderRadius: "8px", fontSize: "12px" }}
            />
            <Bar dataKey="recettes" fill="#075B32" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#17231C]">Volume de commandes</h2>
          <ShoppingCart className="w-4 h-4 text-[#175CD3]" />
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E3" vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 12, fill: "#66736A" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#66736A" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid #E2E8E3", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="commandes" fill="#175CD3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
