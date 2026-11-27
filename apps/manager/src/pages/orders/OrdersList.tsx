import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, ShoppingCart } from "lucide-react";
import { supabase } from "../../lib/supabase";

type OrderStatus = "draft" | "confirmed" | "in_production" | "qc" | "ready" | "delivered" | "closed";

interface Order {
  id: string; order_number: string; customer_name: string;
  service_summary: string; status: OrderStatus;
  total_xaf: number; created_at: string; due_date?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  draft:         { label: "Brouillon",     cls: "bg-[#F5F7F5] text-[#66736A]" },
  confirmed:     { label: "Confirmée",     cls: "bg-blue-50 text-[#175CD3]" },
  in_production: { label: "En production", cls: "bg-orange-50 text-[#B54708]" },
  qc:            { label: "Contrôle QC",   cls: "bg-purple-50 text-purple-700" },
  ready:         { label: "Prête",         cls: "bg-[#E8F3EC] text-[#067647]" },
  delivered:     { label: "Livrée",        cls: "bg-[#E8F3EC] text-[#067647]" },
  closed:        { label: "Clôturée",      cls: "bg-[#F5F7F5] text-[#66736A]" },
};

function fmt(xaf: number) {
  return new Intl.NumberFormat("fr-CM").format(xaf) + " FCFA";
}

export function OrdersList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    supabase
      .from("orders")
      .select("id, reference, status, total, order_date, delivery_date, client:client_id(full_name, company_name, is_company), order_lines(description)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setOrders(data.map((o: any, idx: number) => ({
          id: o.id,
          order_number: o.reference ?? "CMD-" + String(idx + 1).padStart(9, "0"),
          customer_name: o.client
            ? (o.client.is_company ? o.client.company_name : o.client.full_name) ?? "—"
            : "—",
          service_summary: o.order_lines?.[0]?.description ?? "—",
          status: (o.status ?? "draft") as OrderStatus,
          total_xaf: Number(o.total) || 0,
          created_at: o.order_date ?? o.created_at?.split("T")[0] ?? "—",
          due_date: o.delivery_date ?? undefined,
        })));
      });
  }, []);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.order_number.includes(q) || o.customer_name.toLowerCase().includes(q);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Commandes</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{filtered.length} commande{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/commandes/nouvelle"
          className="flex items-center gap-2 bg-[#075B32] text-white text-sm px-3 py-2 rounded-lg hover:bg-[#063A22] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle commande
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66736A]" />
          <input
            type="search" placeholder="N° commande ou client…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
          className="text-sm border border-[#E2E8E3] rounded-lg px-3 py-2 bg-white text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Commande</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden md:table-cell">Prestation</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden sm:table-cell">Montant</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8E3]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#66736A]">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
                  <p>Aucune commande trouvée</p>
                </td>
              </tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="hover:bg-[#F5F7F5] transition-colors">
                <td className="px-4 py-3">
                  <Link to={`/commandes/${o.id}`} className="hover:text-[#075B32]">
                    <p className="font-medium text-[#17231C]">{o.customer_name}</p>
                    <p className="text-xs text-[#66736A] font-mono">{o.order_number}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#66736A] text-xs hidden md:table-cell">{o.service_summary}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[o.status].cls}`}>{STATUS_CONFIG[o.status].label}</span>
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-[#17231C] hidden sm:table-cell">
                  {fmt(o.total_xaf)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/commandes/${o.id}`} className="text-[#075B32] text-xs hover:underline">Voir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
