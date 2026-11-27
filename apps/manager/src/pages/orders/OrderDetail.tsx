import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, FileText, ChevronRight } from "lucide-react";

const STATUS_STEPS = ["draft","confirmed","in_production","qc","ready","delivered","closed"];
const STATUS_LABELS: Record<string,string> = {
  draft:"Brouillon", confirmed:"Confirmée", in_production:"En production",
  qc:"Contrôle QC", ready:"Prête", delivered:"Livrée", closed:"Clôturée",
};

export function OrderDetail() {
  const { id } = useParams();
  const order = {
    id, order_number: "CMD-2026-000001", status: "in_production",
    customer_name: "Société ABC SARL", customer_number: "CLI-000001",
    service_summary: "Impression A4 couleur × 50", total_xaf: 12500,
    created_at: "2026-11-21T08:30:00Z", due_date: "2026-11-21",
  };

  const currentIdx = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/commandes" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" />
        Commandes
      </Link>

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-[#E2E8E3] p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-[#17231C]">{order.order_number}</h1>
            <p className="text-sm text-[#66736A]">{order.customer_name}</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 text-sm border border-[#E2E8E3] rounded-lg px-3 py-2 text-[#17231C] hover:bg-[#F5F7F5]">
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button className="flex items-center gap-2 text-sm border border-[#E2E8E3] rounded-lg px-3 py-2 text-[#17231C] hover:bg-[#F5F7F5]">
              <FileText className="w-4 h-4" />
              Facture
            </button>
          </div>
        </div>

        {/* Suivi statut */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STATUS_STEPS.slice(1, 7).map((s, i) => {
            const done = STATUS_STEPS.indexOf(s) <= currentIdx;
            const active = s === order.status;
            return (
              <div key={s} className="flex items-center gap-1">
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap font-medium ${
                  active ? "bg-[#075B32] text-white" :
                  done   ? "bg-[#E8F3EC] text-[#067647]" :
                           "bg-[#F5F7F5] text-[#66736A]"
                }`}>
                  {STATUS_LABELS[s]}
                </span>
                {i < 5 && <ChevronRight className="w-3 h-3 text-[#E2E8E3] shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Détails */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">
          <h2 className="text-sm font-semibold text-[#17231C] mb-3">Prestations</h2>
          <div className="text-sm text-[#66736A]">{order.service_summary}</div>
          <div className="mt-4 pt-4 border-t border-[#E2E8E3] flex justify-between">
            <span className="text-sm font-medium text-[#17231C]">Total</span>
            <span className="text-sm font-bold text-[#17231C] tabular-nums">
              {new Intl.NumberFormat("fr-CM").format(order.total_xaf)} FCFA
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">
          <h2 className="text-sm font-semibold text-[#17231C] mb-3">Informations</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#66736A]">Date</dt>
              <dd className="text-[#17231C]">{new Date(order.created_at).toLocaleDateString("fr-CM")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#66736A]">Délai</dt>
              <dd className="text-[#17231C]">{order.due_date ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
