import { Printer, Clock, CheckCircle, AlertCircle } from "lucide-react";

type JobStatus = "pending" | "printing" | "done" | "error";

interface PrintJob {
  id: string; job_ref: string; customer_name: string;
  description: string; pages: number; copies: number;
  status: JobStatus; queued_at: string;
}

const STATUS_CFG: Record<JobStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: "En attente",  cls: "bg-orange-50 text-[#B54708]", icon: Clock },
  printing: { label: "Impression",  cls: "bg-blue-50 text-[#175CD3]",   icon: Printer },
  done:     { label: "Terminé",     cls: "bg-[#E8F3EC] text-[#067647]", icon: CheckCircle },
  error:    { label: "Erreur",      cls: "bg-red-50 text-[#B42318]",    icon: AlertCircle },
};

const JOBS: PrintJob[] = [];

export function PrintQueue() {
  const active = JOBS.filter(j => j.status === "pending" || j.status === "printing").length;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">File d'impression</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{active} travaux actifs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-[#067647] bg-[#E8F3EC] px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#067647] animate-pulse" />
            Imprimante en ligne
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {JOBS.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8E3] flex flex-col items-center justify-center py-16 text-center">
            <Printer className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
            <p className="text-sm text-[#A0ADA5]">Aucun travail en file d'impression</p>
          </div>
        ) : JOBS.map((job) => (
          <div key={job.id} className="bg-white rounded-xl border border-[#E2E8E3] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${STATUS_CFG[job.status].cls}`}>
                  {(() => { const I = STATUS_CFG[job.status].icon; return <I className="w-5 h-5" />; })()}
                </div>
                <div>
                  <p className="font-medium text-sm text-[#17231C]">{job.customer_name}</p>
                  <p className="text-xs text-[#66736A]">{job.job_ref} · {job.description}</p>
                  <p className="text-xs text-[#66736A]">{job.pages} p. × {job.copies} ex.</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[job.status].cls}`}>{STATUS_CFG[job.status].label}</span>
                <p className="text-xs text-[#66736A] mt-1">{job.queued_at}</p>
              </div>
            </div>
            {job.status === "printing" && (
              <div className="mt-3 h-1.5 bg-[#E2E8E3] rounded-full overflow-hidden">
                <div className="h-full bg-[#075B32] rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
