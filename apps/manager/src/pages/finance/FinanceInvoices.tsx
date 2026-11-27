import { useState, useEffect } from "react";
import { FileText, Plus, Download } from "lucide-react";
import { supabase } from "../../lib/supabase";

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "void";
interface Invoice {
  id: string; invoice_number: string; customer_name: string;
  total_xaf: number; paid_xaf: number; status: InvoiceStatus;
  issued_at: string; due_date: string;
}

const STATUS_CFG: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft:   { label: "Brouillon",   cls: "bg-[#F5F7F5] text-[#66736A]" },
  sent:    { label: "Envoyée",     cls: "bg-blue-50 text-[#175CD3]" },
  partial: { label: "Partielle",   cls: "bg-orange-50 text-[#B54708]" },
  paid:    { label: "Payée",       cls: "bg-[#E8F3EC] text-[#067647]" },
  overdue: { label: "En retard",   cls: "bg-red-50 text-[#B42318]" },
  void:    { label: "Annulée",     cls: "bg-[#F5F7F5] text-[#66736A]" },
};

export function FinanceInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, issued_at, due_date, client:client_id(full_name, company_name, is_company)")
      .is("deleted_at", null)
      .order("issued_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setInvoices(data.map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.invoice_number ?? "—",
          customer_name: inv.client
            ? (inv.client.is_company ? inv.client.company_name : inv.client.full_name) ?? "—"
            : "—",
          total_xaf: Number(inv.total) || 0,
          paid_xaf: Number(inv.amount_paid) || 0,
          status: (inv.status ?? "draft") as InvoiceStatus,
          issued_at: inv.issued_at ?? "—",
          due_date: inv.due_date ?? "—",
        })));
      });
  }, []);

  const totalDue = invoices.filter(i => i.status !== "void").reduce((s,i) => s + (i.total_xaf - i.paid_xaf), 0);
  const totalPaid = invoices.reduce((s,i) => s + i.paid_xaf, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Factures & Paiements</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{invoices.length} facture{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] text-white text-sm px-3 py-2 rounded-lg hover:bg-[#063A22]">
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
          <p className="text-xs text-[#66736A] mb-1">En attente de paiement</p>
          <p className="text-xl font-bold text-[#17231C] tabular-nums">{fmt(totalDue)} FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
          <p className="text-xs text-[#66736A] mb-1">Encaissé ce mois</p>
          <p className="text-xl font-bold text-[#075B32] tabular-nums">{fmt(totalPaid)} FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
          <p className="text-xs text-[#66736A] mb-1">Taux de recouvrement</p>
          <p className="text-xl font-bold text-[#17231C] tabular-nums">
            {totalPaid + totalDue > 0 ? Math.round(totalPaid / (totalPaid + totalDue) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Facture</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Montant</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden md:table-cell">Payé</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8E3]">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#66736A]">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
                  <p>Aucune facture enregistrée</p>
                </td>
              </tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-[#F5F7F5] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E8F3EC] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#075B32]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#17231C] text-sm">{inv.customer_name}</p>
                      <p className="text-xs text-[#66736A] font-mono">{inv.invoice_number} · {inv.issued_at}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#17231C]">{fmt(inv.total_xaf)} F</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#067647] hidden md:table-cell">{fmt(inv.paid_xaf)} F</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[inv.status].cls}`}>{STATUS_CFG[inv.status].label}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1.5 hover:bg-[#E8F3EC] rounded text-[#075B32]" title="Télécharger PDF">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
