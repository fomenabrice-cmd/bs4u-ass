import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Lock, Clock, ArrowLeft, User } from "lucide-react";
import { supabase } from "../../lib/supabase";

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

const MVT_LABELS: Record<string, string> = {
  opening: "Ouverture", closing: "Clôture",
  sale: "Vente", payment_received: "Encaissement",
  momo_commission: "Commission MoMo", expense: "Dépense",
  fund_addition: "Entrée de fonds", fund_withdrawal: "Sortie de fonds",
  adjustment: "Ajustement", administrative: "Administratif",
};

type Closing = { theoretical_xaf: number; counted_xaf: number; difference_xaf: number };
type Session = {
  id: string;
  status: string;
  opening_amount_xaf: number;
  opened_at: string;
  register_name: string;
  cashier_id: string | null;
  closing: Closing | null;
};
type Movement = {
  id: string;
  movement_type: string;
  amount_xaf: number;
  description: string;
  created_at: string;
  performed_by: string | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#E8F3EC] text-[#067647]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#067647]" /> Ouverte
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-[#F5F7F5] text-[#66736A]">
      <Lock className="w-3 h-3" /> Clôturée
    </span>
  );
}

function SessionRow({ session, userMap }: { session: Session; userMap: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [mvtUserMap, setMvtUserMap] = useState<Record<string, string>>({});

  async function expand() {
    if (!expanded && movements.length === 0) {
      setLoading(true);
      const { data } = await supabase
        .from("cash_movements")
        .select("id, movement_type, amount_xaf, description, created_at, performed_by")
        .eq("cash_session_id", session.id)
        .order("created_at", { ascending: true });
      setMovements(data ?? []);

      const perfIds = [...new Set((data ?? []).map((m: any) => m.performed_by).filter(Boolean))];
      if (perfIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name").in("id", perfIds);
        const map: Record<string, string> = {};
        for (const p of profs ?? []) map[p.id] = (p as any).full_name ?? "—";
        setMvtUserMap(map);
      }
      setLoading(false);
    }
    setExpanded((v) => !v);
  }

  const diff = session.closing?.difference_xaf ?? null;
  const cashierName = userMap[session.cashier_id ?? ""] ?? null;
  const dateLabel = new Date(session.opened_at).toLocaleDateString("fr-CM", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
  const timeLabel = new Date(session.opened_at).toLocaleTimeString("fr-CM", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <tr
        onClick={expand}
        className="hover:bg-[#F5F7F5] cursor-pointer transition-colors border-b border-[#E2E8E3]"
      >
        <td className="px-4 py-3 w-5">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-[#66736A]" />
            : <ChevronRight className="w-4 h-4 text-[#66736A]" />}
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-[#17231C]">{dateLabel}</p>
          <p className="text-xs text-[#66736A] flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />{timeLabel}
          </p>
          {cashierName && (
            <p className="text-xs text-[#A0ADA5] flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3" />{cashierName}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-[#17231C]">{session.register_name}</td>
        <td className="px-4 py-3 text-right tabular-nums text-sm font-medium text-[#17231C]">
          {fmt(session.opening_amount_xaf)} F
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm">
          {session.closing ? (
            <span className="font-medium text-[#17231C]">{fmt(session.closing.counted_xaf)} F</span>
          ) : (
            <span className="text-[#A0ADA5]">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm">
          {diff !== null ? (
            <span className={`font-medium ${diff === 0 ? "text-[#067647]" : diff > 0 ? "text-blue-600" : "text-[#B42318]"}`}>
              {diff > 0 ? "+" : ""}{fmt(diff)} F
            </span>
          ) : (
            <span className="text-[#A0ADA5]">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={session.status} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-[#FAFBFA]">
          <td colSpan={7} className="px-6 py-3">
            {loading ? (
              <p className="text-xs text-[#A0ADA5] py-2">Chargement…</p>
            ) : movements.length === 0 ? (
              <p className="text-xs text-[#A0ADA5] py-2">Aucun mouvement</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#A0ADA5] border-b border-[#E2E8E3]">
                    <th className="text-left pb-1.5 pr-4 font-medium">Heure</th>
                    <th className="text-left pb-1.5 pr-4 font-medium">Type</th>
                    <th className="text-left pb-1.5 pr-4 font-medium">Description</th>
                    <th className="text-left pb-1.5 pr-4 font-medium">Opérateur</th>
                    <th className="text-right pb-1.5 font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8E3]">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="py-1.5 pr-4 text-[#66736A]">
                        {new Date(m.created_at).toLocaleTimeString("fr-CM", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-1.5 pr-4 font-medium text-[#17231C]">
                        {MVT_LABELS[m.movement_type] ?? m.movement_type}
                      </td>
                      <td className="py-1.5 pr-4 text-[#66736A]">{m.description}</td>
                      <td className="py-1.5 pr-4 text-[#66736A]">
                        {m.performed_by ? (mvtUserMap[m.performed_by] ?? "—") : "—"}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums font-semibold ${m.amount_xaf >= 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                        {m.amount_xaf >= 0 ? "+" : ""}{fmt(m.amount_xaf)} F
                      </td>
                    </tr>
                  ))}
                  {session.closing && (
                    <tr className="bg-[#F5F7F5] border-t-2 border-[#E2E8E3]">
                      <td className="py-2 pr-4 text-[#66736A]" />
                      <td className="py-2 pr-4 font-semibold text-[#17231C]">Clôture</td>
                      <td className="py-2 pr-4 text-[#66736A]">
                        <span className="mr-3">Théorique&nbsp;: <span className="tabular-nums font-medium text-[#17231C]">{fmt(session.closing.theoretical_xaf)} F</span></span>
                        <span>Compté&nbsp;: <span className="tabular-nums font-medium text-[#17231C]">{fmt(session.closing.counted_xaf)} F</span></span>
                      </td>
                      <td className="py-2 pr-4 text-[#66736A]" />
                      <td className={`py-2 text-right tabular-nums font-semibold ${
                        session.closing.difference_xaf === 0 ? "text-[#067647]"
                        : session.closing.difference_xaf > 0 ? "text-blue-600"
                        : "text-[#B42318]"
                      }`}>
                        {session.closing.difference_xaf > 0 ? "+" : ""}{fmt(session.closing.difference_xaf)} F
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function CashHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "suivi">("sessions");
  const [suiviMvts, setSuiviMvts] = useState<(Movement & { cash_session_id: string })[]>([]);
  const [loadingSuivi, setLoadingSuivi] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const orgId = (user as any).app_metadata?.organization_id as string | null;
    if (!orgId) { setLoading(false); return; }

    const { data } = await supabase
      .from("cash_sessions")
      .select(`
        id, status, opening_amount_xaf, opened_at, cashier_id,
        cash_register:cash_register_id(name),
        cash_closings(theoretical_xaf, counted_xaf, difference_xaf)
      `)
      .eq("organization_id", orgId)
      .order("opened_at", { ascending: false })
      .limit(60);

    const mapped: Session[] = (data ?? []).map((s: any) => ({
      id: s.id,
      status: s.status,
      opening_amount_xaf: s.opening_amount_xaf,
      opened_at: s.opened_at,
      cashier_id: s.cashier_id ?? null,
      register_name: s.cash_register?.name ?? "—",
      closing: s.cash_closings?.[0] ?? null,
    }));
    setSessions(mapped);

    // Batch fetch cashier profiles
    const cashierIds = [...new Set(mapped.map((s) => s.cashier_id).filter(Boolean))] as string[];
    if (cashierIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name").in("id", cashierIds);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) map[p.id] = (p as any).full_name ?? "—";
      setUserMap(map);
    }
    setLoading(false);
  }, []);

  async function loadSuivi() {
    if (loadingSuivi || suiviMvts.length) return;
    setLoadingSuivi(true);
    const sessIds = sessions.map(s => s.id);
    if (!sessIds.length) { setLoadingSuivi(false); return; }
    const { data } = await supabase
      .from("cash_movements")
      .select("id, movement_type, amount_xaf, description, created_at, performed_by, cash_session_id")
      .in("cash_session_id", sessIds)
      .order("created_at", { ascending: true });
    setSuiviMvts((data ?? []) as any);
    setLoadingSuivi(false);
  }

  useEffect(() => { load(); }, [load]);

  const closedSessions = sessions.filter((s) => s.status === "closed");
  const totalOpening = closedSessions.reduce((sum, s) => sum + s.opening_amount_xaf, 0);
  const totalCounted = closedSessions.reduce((sum, s) => sum + (s.closing?.counted_xaf ?? 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/caisse" className="flex items-center gap-1.5 text-sm text-[#66736A] hover:text-[#075B32] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Session en cours
        </Link>
        <span className="text-[#E2E8E3]">/</span>
        <h1 className="text-xl font-semibold text-[#17231C]">Historique caisse</h1>
      </div>

      {closedSessions.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
            <p className="text-xs text-[#66736A] mb-1">Sessions clôturées</p>
            <p className="text-2xl font-bold text-[#17231C]">{closedSessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
            <p className="text-xs text-[#66736A] mb-1">Total ouvertures</p>
            <p className="text-2xl font-bold text-[#17231C] tabular-nums">{fmt(totalOpening)} F</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
            <p className="text-xs text-[#66736A] mb-1">Total compté</p>
            <p className="text-2xl font-bold text-[#17231C] tabular-nums">{fmt(totalCounted)} F</p>
          </div>
          {(() => {
            const nbDeficits = closedSessions.filter(s => (s.closing?.difference_xaf ?? 0) < 0).length;
            return (
              <div className={`rounded-xl border p-4 ${nbDeficits > 0 ? "bg-red-50 border-red-200" : "bg-white border-[#E2E8E3]"}`}>
                <p className="text-xs text-[#66736A] mb-1">Déficits détectés</p>
                <p className={`text-2xl font-bold ${nbDeficits > 0 ? "text-[#B42318]" : "text-[#17231C]"}`}>{nbDeficits}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Onglets */}
      <div className="flex border-b border-[#E2E8E3] mb-4">
        {(["sessions", "suivi"] as const).map(tab => (
          <button key={tab}
            onClick={() => { setActiveTab(tab); if (tab === "suivi") loadSuivi(); }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab ? "border-[#075B32] text-[#075B32]" : "border-transparent text-[#66736A] hover:text-[#17231C]"
            }`}>
            {tab === "sessions" ? "Sessions" : "Suivi financier"}
          </button>
        ))}
      </div>

      {activeTab === "sessions" && (
        <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-[#A0ADA5]">Chargement…</div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-[#A0ADA5]">
              Aucune session de caisse enregistrée
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
                  <th className="w-5 px-4 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Date / Caissier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Caisse</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Ouverture</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Compté</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Écart</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => <SessionRow key={s.id} session={s} userMap={userMap} />)}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "suivi" && (
        <div className="space-y-6">
          {/* Analyse ouverture / clôture */}
          <div>
            <h2 className="text-sm font-semibold text-[#17231C] mb-3">Analyse ouverture / clôture</h2>
            <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
              {closedSessions.length === 0 ? (
                <p className="text-sm text-[#A0ADA5] text-center py-8">Aucune session clôturée</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Date / Caisse</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Ouverture</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Théorique</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Compté</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Écart</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8E3]">
                    {closedSessions.map(s => {
                      const diff = s.closing?.difference_xaf ?? null;
                      return (
                        <tr key={s.id} className="hover:bg-[#F5F7F5]">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-[#17231C]">
                              {new Date(s.opened_at).toLocaleDateString("fr-CM", { weekday: "short", day: "2-digit", month: "short" })}
                            </p>
                            <p className="text-xs text-[#A0ADA5]">{s.register_name}</p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm font-medium text-[#17231C]">{fmt(s.opening_amount_xaf)} F</td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm text-[#17231C]">
                            {s.closing ? fmt(s.closing.theoretical_xaf) + " F" : <span className="text-[#A0ADA5]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm text-[#17231C]">
                            {s.closing ? fmt(s.closing.counted_xaf) + " F" : <span className="text-[#A0ADA5]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold">
                            {diff !== null
                              ? <span className={diff === 0 ? "text-[#067647]" : diff > 0 ? "text-blue-600" : "text-[#B42318]"}>{diff > 0 ? "+" : ""}{fmt(diff)} F</span>
                              : <span className="text-[#A0ADA5]">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {diff === null ? <span className="text-xs text-[#A0ADA5]">En cours</span>
                              : diff === 0 ? <span className="text-xs font-medium text-[#067647] bg-[#E8F3EC] px-2 py-0.5 rounded-full">Équilibré</span>
                              : diff > 0 ? <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Excédent</span>
                              : <span className="text-xs font-medium text-[#B42318] bg-red-50 px-2 py-0.5 rounded-full">Déficit</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const totalDiff = closedSessions.reduce((s, x) => s + (x.closing?.difference_xaf ?? 0), 0);
                      const totalTheo = closedSessions.reduce((s, x) => s + (x.closing?.theoretical_xaf ?? 0), 0);
                      const totalCounted2 = closedSessions.reduce((s, x) => s + (x.closing?.counted_xaf ?? 0), 0);
                      return (
                        <tr className="bg-[#F5F7F5] border-t-2 border-[#E2E8E3]">
                          <td className="px-4 py-3 text-sm font-semibold text-[#17231C]">Total ({closedSessions.length})</td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-[#17231C]">{fmt(totalOpening)} F</td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-[#17231C]">{fmt(totalTheo)} F</td>
                          <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-[#17231C]">{fmt(totalCounted2)} F</td>
                          <td className={`px-4 py-3 text-right tabular-nums text-sm font-bold ${totalDiff === 0 ? "text-[#067647]" : totalDiff > 0 ? "text-blue-600" : "text-[#B42318]"}`}>
                            {totalDiff > 0 ? "+" : ""}{fmt(totalDiff)} F
                          </td>
                          <td className="px-4 py-3" />
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Journal consolidé — balance continue jour après jour */}
          <div>
            <h2 className="text-sm font-semibold text-[#17231C] mb-3">Journal consolidé</h2>
            {loadingSuivi ? (
              <div className="flex justify-center py-8 text-sm text-[#A0ADA5]">Chargement des mouvements…</div>
            ) : !suiviMvts.length ? (
              <p className="text-sm text-[#A0ADA5] text-center py-8">Aucun mouvement enregistré</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  // Tri ascendant pour continuité chronologique
                  const sessionsAsc = [...sessions].sort((a, b) =>
                    new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
                  );
                  let prevClosing: number | null = null;
                  return sessionsAsc.map(session => {
                    const mvts = suiviMvts
                      .filter((m: any) => m.cash_session_id === session.id)
                      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                    // Discordance : solde clôture précédente ≠ fond ouverture actuelle
                    const prevSnap = prevClosing;
                    const discrepancyAmt = prevSnap !== null ? session.opening_amount_xaf - prevSnap : 0;

                    // Pré-calcul des soldes par mouvement
                    let running = session.opening_amount_xaf;
                    const mvtsWithBalance = mvts.map((m: any) => {
                      running += m.amount_xaf;
                      return { ...m, balance: running };
                    });

                    // Solde final : compté si clôturé, théorique si ouvert
                    const endBalance = session.closing ? session.closing.counted_xaf : running;
                    prevClosing = endBalance;

                    if (!mvts.length && !session.closing) return null;

                    return (
                      <div key={session.id} className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[#E2E8E3] bg-[#F5F7F5] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#17231C]">
                              {new Date(session.opened_at).toLocaleDateString("fr-CM", { weekday: "long", day: "2-digit", month: "long" })}
                            </span>
                            <span className="text-xs text-[#A0ADA5]">— {session.register_name}</span>
                          </div>
                          <span className="text-xs text-[#66736A] tabular-nums">Fond : {fmt(session.opening_amount_xaf)} F</span>
                        </div>

                        {/* Bannière discordance */}
                        {discrepancyAmt !== 0 && prevSnap !== null && (
                          <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 flex items-center justify-between text-xs">
                            <span className="text-orange-700 font-medium">⚠ Discordance à l'ouverture</span>
                            <span className="tabular-nums text-orange-700">
                              Attendu : <span className="font-semibold">{fmt(prevSnap)} F</span>
                              {" — "}Ouvert avec : <span className="font-semibold">{fmt(session.opening_amount_xaf)} F</span>
                              <span className={`ml-2 font-bold ${discrepancyAmt < 0 ? "text-[#B42318]" : "text-blue-600"}`}>
                                ({discrepancyAmt > 0 ? "+" : ""}{fmt(discrepancyAmt)} F)
                              </span>
                            </span>
                          </div>
                        )}

                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[#A0ADA5] border-b border-[#E2E8E3]">
                              <th className="text-left px-4 py-2 font-medium">Heure</th>
                              <th className="text-left px-4 py-2 font-medium">Type</th>
                              <th className="text-left px-4 py-2 font-medium">Description</th>
                              <th className="text-right px-4 py-2 font-medium">Montant</th>
                              <th className="text-right px-4 py-2 font-medium">Solde</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8E3]">
                            <tr className="bg-[#E8F3EC]/30">
                              <td colSpan={4} className="px-4 py-1.5 text-[#66736A]">Fond d'ouverture</td>
                              <td className="px-4 py-1.5 text-right tabular-nums font-semibold text-[#17231C]">{fmt(session.opening_amount_xaf)} F</td>
                            </tr>
                            {mvtsWithBalance.map(m => (
                              <tr key={m.id}>
                                <td className="px-4 py-1.5 text-[#66736A]">
                                  {new Date(m.created_at).toLocaleTimeString("fr-CM", { hour: "2-digit", minute: "2-digit" })}
                                </td>
                                <td className="px-4 py-1.5 font-medium text-[#17231C]">{MVT_LABELS[m.movement_type] ?? m.movement_type}</td>
                                <td className="px-4 py-1.5 text-[#66736A]">{m.description ?? "—"}</td>
                                <td className={`px-4 py-1.5 text-right tabular-nums font-semibold ${m.amount_xaf >= 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                                  {m.amount_xaf >= 0 ? "+" : ""}{fmt(m.amount_xaf)} F
                                </td>
                                <td className="px-4 py-1.5 text-right tabular-nums font-medium text-[#17231C]">{fmt(m.balance)} F</td>
                              </tr>
                            ))}
                            {session.closing && (
                              <tr className="bg-[#F5F7F5] border-t border-[#E2E8E3]">
                                <td colSpan={3} className="px-4 py-2 font-semibold text-[#17231C]">
                                  Clôture — Compté : {fmt(session.closing.counted_xaf)} F
                                </td>
                                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${
                                  session.closing.difference_xaf === 0 ? "text-[#067647]"
                                  : session.closing.difference_xaf > 0 ? "text-blue-600"
                                  : "text-[#B42318]"
                                }`}>
                                  Écart : {session.closing.difference_xaf > 0 ? "+" : ""}{fmt(session.closing.difference_xaf)} F
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#17231C]">
                                  {fmt(session.closing.counted_xaf)} F
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>

                        {/* Pied : solde de continuité vers prochaine session */}
                        <div className="px-4 py-2 border-t border-[#E2E8E3] bg-[#F5F7F5] flex items-center justify-between text-xs">
                          <span className="text-[#66736A]">
                            {session.closing ? "✓ Solde reporté à la prochaine session" : "⏳ Solde théorique (session en cours)"}
                          </span>
                          <span className={`tabular-nums font-semibold ${endBalance < 0 ? "text-[#B42318]" : "text-[#17231C]"}`}>
                            {fmt(endBalance)} F
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
