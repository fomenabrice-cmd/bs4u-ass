import { useState, useEffect } from "react";
import {
  Users, Banknote, Smartphone, Clock, Plus, Edit2, Save,
  X, Check, Loader2, ChevronDown, AlertCircle, Trash2,
  UserCheck, Shield, Signal, Wallet, QrCode
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = "super_admin" | "admin" | "manager" | "secretary" | "accountant" | "member" | "viewer" | "discover";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin", admin: "Administrateur", manager: "Gérant",
  secretary: "Secrétaire", accountant: "Comptable", member: "Employé",
  viewer: "Observateur", discover: "Découverte",
};

const ROLE_COLORS: Record<Role, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
  manager: "bg-blue-100 text-blue-700",
  secretary: "bg-teal-100 text-teal-700",
  accountant: "bg-amber-100 text-amber-700",
  member: "bg-green-100 text-green-700",
  viewer: "bg-gray-100 text-gray-600",
  discover: "bg-gray-100 text-gray-500",
};

type Member = {
  id: string;        // profiles.id = auth.uid
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  role_id: string;   // user_roles.id
  is_active: boolean;
};

type CashRegister = {
  id: string;
  name: string;
  code: string | null;
  opening_time: string;
  closing_time: string;
  is_active: boolean;
  auto_close_enabled: boolean;
  auto_close_time: string;
};

type MomoAccount = {
  id: string;
  provider: "orange_money" | "mtn_momo";
  account_number: string;
  account_name: string;
  owner_name: string | null;
  qr_data: string | null;
  is_active: boolean;
  notes: string | null;
  commission_ref1_amount: number | null;
  commission_ref1_fee: number | null;
  commission_ref2_amount: number | null;
  commission_ref2_fee: number | null;
};

type DaySchedule = { active: boolean; open: string; close: string };
type WorkSchedule = Record<string, DaySchedule>;

type FlotteProvider = {
  enabled: boolean;
  request_deadline: string;    // heure limite de demande
  repayment_deadline: string;  // heure limite de remboursement
};
type FlotteSettings = { orange_money: FlotteProvider; mtn_momo: FlotteProvider };

const DEFAULT_FLOTTE: FlotteSettings = {
  orange_money: { enabled: true, request_deadline: "11:00", repayment_deadline: "16:00" },
  mtn_momo:     { enabled: true, request_deadline: "11:00", repayment_deadline: "16:00" },
};

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOUR_LABELS: Record<string, string> = {
  lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi",
  vendredi: "Vendredi", samedi: "Samedi", dimanche: "Dimanche",
};
const DEFAULT_SCHEDULE: WorkSchedule = Object.fromEntries(
  JOURS.map(j => [j, { active: j !== "dimanche", open: "08:00", close: "17:00" }])
);

const PROVIDER_LABELS = { orange_money: "Orange Money", mtn_momo: "MTN MoMo" };

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function Tab({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-[#075B32] text-white shadow-sm"
          : "text-[#66736A] hover:text-[#17231C] hover:bg-[#E8F3EC]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">{children}</div>;
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-[#17231C]">{title}</h2>
      {action}
    </div>
  );
}

function Badge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function Initials({ name, url }: { name: string; url?: string | null }) {
  const letters = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  if (url) return <img src={url} className="w-9 h-9 rounded-full object-cover" alt={name} />;
  return (
    <div className="w-9 h-9 rounded-full bg-[#075B32] flex items-center justify-center shrink-0">
      <span className="text-white text-xs font-bold">{letters}</span>
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[#075B32] font-medium hover:bg-[#E8F3EC] px-3 py-1.5 rounded-lg transition-colors">
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

// ─── Tabs content ─────────────────────────────────────────────────────────────

function MembresTab({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>("member");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id, role, is_active, profiles(full_name, phone, avatar_url)")
      .eq("organization_id", orgId)
      .order("created_at");
    if (data) {
      setMembers(data.map((r: any) => ({
        id: r.user_id,
        full_name: r.profiles?.full_name ?? "—",
        phone: r.profiles?.phone ?? null,
        avatar_url: r.profiles?.avatar_url ?? null,
        role: r.role as Role,
        role_id: r.id,
        is_active: r.is_active,
      })));
    }
    setLoading(false);
  }

  async function saveRole(roleId: string) {
    setSaving(true);
    await supabase.from("user_roles").update({ role: editRole }).eq("id", roleId);
    setSaving(false);
    setEditId(null);
    load();
  }

  async function toggleActive(roleId: string, current: boolean) {
    await supabase.from("user_roles").update({ is_active: !current }).eq("id", roleId);
    load();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>;

  return (
    <div className="space-y-3">
      {members.map(m => (
        <Card key={m.role_id}>
          <div className="flex items-center gap-3">
            <Initials name={m.full_name} url={m.avatar_url} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-[#17231C] text-sm">{m.full_name}</span>
                <Badge role={m.role} />
                {!m.is_active && (
                  <span className="text-xs text-red-500 font-medium">Inactif</span>
                )}
              </div>
              {m.phone && <p className="text-xs text-[#A0ADA5] mt-0.5">{m.phone}</p>}
            </div>

            {editId === m.role_id ? (
              <div className="flex items-center gap-2">
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as Role)}
                  className="text-sm border border-[#E2E8E3] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#075B32]"
                >
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <button onClick={() => saveRole(m.role_id)} disabled={saving}
                  className="p-1.5 bg-[#075B32] text-white rounded-lg hover:bg-[#063A22] disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditId(null)}
                  className="p-1.5 text-[#A0ADA5] hover:text-[#17231C] rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditId(m.role_id); setEditRole(m.role); }}
                  className="p-1.5 text-[#A0ADA5] hover:text-[#075B32] rounded-lg transition-colors" title="Changer le rôle">
                  <Shield className="w-4 h-4" />
                </button>
                <button onClick={() => toggleActive(m.role_id, m.is_active)}
                  className={`p-1.5 rounded-lg transition-colors ${m.is_active ? "text-[#A0ADA5] hover:text-red-500" : "text-red-400 hover:text-[#075B32]"}`}
                  title={m.is_active ? "Désactiver" : "Activer"}>
                  <UserCheck className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </Card>
      ))}
      {members.length === 0 && (
        <div className="text-center py-12 text-[#A0ADA5]">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun membre dans l'organisation</p>
        </div>
      )}
    </div>
  );
}

function CaissesTab({ orgId }: { orgId: string }) {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ name: "", opening_time: "08:00", closing_time: "17:00", auto_close_enabled: false, auto_close_time: "00:00" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("cash_registers")
      .select("id, name, code, opening_time, closing_time, is_active, auto_close_enabled, auto_close_time")
      .eq("organization_id", orgId)
      .order("name");
    setRegisters((data ?? []).map((r: any) => ({
      ...r,
      auto_close_enabled: r.auto_close_enabled ?? false,
      auto_close_time: r.auto_close_time ?? "00:00",
    })));
    setLoading(false);
  }

  function startEdit(r: CashRegister) {
    setEditId(r.id);
    setForm({ name: r.name, opening_time: r.opening_time, closing_time: r.closing_time, auto_close_enabled: r.auto_close_enabled, auto_close_time: r.auto_close_time });
    setErr("");
  }

  function startNew() {
    setEditId("new");
    setForm({ name: "", opening_time: "08:00", closing_time: "17:00", auto_close_enabled: false, auto_close_time: "00:00" });
    setErr("");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Le nom est requis"); return; }
    setSaving(true);
    if (editId === "new") {
      await supabase.from("cash_registers").insert({
        organization_id: orgId, name: form.name.trim(),
        opening_time: form.opening_time, closing_time: form.closing_time, is_active: true,
        auto_close_enabled: form.auto_close_enabled, auto_close_time: form.auto_close_time,
      });
    } else {
      await supabase.from("cash_registers").update({
        name: form.name.trim(), opening_time: form.opening_time, closing_time: form.closing_time,
        auto_close_enabled: form.auto_close_enabled, auto_close_time: form.auto_close_time,
      }).eq("id", editId);
    }
    setSaving(false);
    setEditId(null);
    load();
  }

  async function toggle(id: string, current: boolean) {
    await supabase.from("cash_registers").update({ is_active: !current }).eq("id", id);
    load();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>;

  return (
    <div className="space-y-3">
      <SectionTitle title="Registres de caisse"
        action={editId !== "new" && <AddBtn onClick={startNew} label="Ajouter une caisse" />} />

      {editId === "new" && (
        <Card>
          <p className="text-xs font-semibold text-[#075B32] uppercase tracking-wide mb-3">Nouvelle caisse</p>
          <FormFields form={form} setForm={setForm} err={err} />
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
            </button>
            <button onClick={() => setEditId(null)}
              className="px-4 py-2 text-sm text-[#66736A] hover:text-[#17231C] rounded-lg border border-[#E2E8E3]">
              Annuler
            </button>
          </div>
        </Card>
      )}

      {registers.map(r => (
        <Card key={r.id}>
          {editId === r.id ? (
            <>
              <FormFields form={form} setForm={setForm} err={err} />
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
                <button onClick={() => setEditId(null)}
                  className="px-4 py-2 text-sm text-[#66736A] hover:text-[#17231C] rounded-lg border border-[#E2E8E3]">
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E8F3EC] flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-[#075B32]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[#17231C]">{r.name}</span>
                  {!r.is_active && <span className="text-xs text-red-500 font-medium">Inactive</span>}
                </div>
                <p className="text-xs text-[#A0ADA5]">
                  {r.opening_time} – {r.closing_time}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => startEdit(r)}
                  className="p-1.5 text-[#A0ADA5] hover:text-[#075B32] rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggle(r.id, r.is_active)}
                  className={`p-1.5 rounded-lg transition-colors text-xs font-medium px-2 py-1 ${r.is_active ? "text-[#A0ADA5] hover:text-red-500 border border-[#E2E8E3]" : "text-green-600 hover:text-green-700 border border-green-200"}`}>
                  {r.is_active ? "Désactiver" : "Activer"}
                </button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {registers.length === 0 && editId !== "new" && (
        <div className="text-center py-12 text-[#A0ADA5]">
          <Banknote className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune caisse configurée</p>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full border border-[#E2E8E3] rounded-lg px-3 py-2 text-sm text-[#17231C] bg-white placeholder:text-[#B0BAB4] focus:outline-none focus:ring-2 focus:ring-[#075B32]";
const timeCls  = "border border-[#E2E8E3] rounded-lg px-3 py-2 text-sm text-[#17231C] bg-white focus:outline-none focus:ring-2 focus:ring-[#075B32]";

function FormFields({ form, setForm, err }: {
  form: { name: string; opening_time: string; closing_time: string; auto_close_enabled: boolean; auto_close_time: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; opening_time: string; closing_time: string; auto_close_enabled: boolean; auto_close_time: string }>>;
  err: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[#66736A] mb-1">Nom de la caisse *</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Caisse principale" className={inputCls} />
        {err && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Heure d'ouverture</label>
          <input type="time" value={form.opening_time} onChange={e => setForm(f => ({ ...f, opening_time: e.target.value }))}
            className={timeCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Heure de fermeture</label>
          <input type="time" value={form.closing_time} onChange={e => setForm(f => ({ ...f, closing_time: e.target.value }))}
            className={timeCls} />
        </div>
      </div>
      <div className="border border-[#E2E8E3] rounded-lg p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#17231C]">Fermeture automatique</p>
          <p className="text-xs text-[#A0ADA5] mt-0.5">Clôture la session si elle est encore ouverte à l'heure indiquée</p>
        </div>
        <button type="button" role="switch" aria-checked={form.auto_close_enabled}
          onClick={() => setForm(f => ({ ...f, auto_close_enabled: !f.auto_close_enabled }))}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            form.auto_close_enabled ? "bg-[#075B32]" : "bg-[#D1D5DB]"
          }`}>
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            form.auto_close_enabled ? "translate-x-4" : "translate-x-0"
          }`} />
        </button>
      </div>
      {form.auto_close_enabled && (
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Heure de fermeture automatique</label>
          <input type="time" value={form.auto_close_time} onChange={e => setForm(f => ({ ...f, auto_close_time: e.target.value }))}
            className={timeCls} />
        </div>
      )}
    </div>
  );
}

const MOMO_EMPTY_FORM = {
  provider: "orange_money" as "orange_money" | "mtn_momo",
  account_number: "", account_name: "", owner_name: "", notes: "", qr_data: "",
  commission_ref1_amount: "", commission_ref1_fee: "",
  commission_ref2_amount: "", commission_ref2_fee: "",
};

function MomoTab({ orgId }: { orgId: string }) {
  const [accounts, setAccounts] = useState<MomoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(MOMO_EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showQr, setShowQr] = useState<string | null>(null);

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("mobile_money_accounts")
      .select("id, provider, account_number, account_name, owner_name, qr_data, is_active, notes, commission_ref1_amount, commission_ref1_fee, commission_ref2_amount, commission_ref2_fee")
      .eq("organization_id", orgId)
      .order("provider");
    setAccounts(data ?? []);
    setLoading(false);
  }

  function startEdit(a: MomoAccount) {
    setEditId(a.id);
    setForm({
      provider: a.provider, account_number: a.account_number, account_name: a.account_name,
      owner_name: a.owner_name ?? "", notes: a.notes ?? "", qr_data: a.qr_data ?? "",
      commission_ref1_amount: a.commission_ref1_amount?.toString() ?? "",
      commission_ref1_fee: a.commission_ref1_fee?.toString() ?? "",
      commission_ref2_amount: a.commission_ref2_amount?.toString() ?? "",
      commission_ref2_fee: a.commission_ref2_fee?.toString() ?? "",
    });
    setErr("");
  }

  function startNew() {
    setEditId("new");
    setForm(MOMO_EMPTY_FORM);
    setErr("");
  }

  async function save() {
    if (!form.account_number.trim() || !form.account_name.trim()) {
      setErr("Numéro et nom du compte sont requis"); return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      provider: form.provider,
      account_number: form.account_number.trim(),
      account_name: form.account_name.trim(),
      owner_name: form.owner_name.trim() || null,
      notes: form.notes || null,
      qr_data: form.qr_data.trim() || null,
      commission_ref1_amount: form.commission_ref1_amount ? parseInt(form.commission_ref1_amount) : null,
      commission_ref1_fee:    form.commission_ref1_fee    ? parseInt(form.commission_ref1_fee)    : null,
      commission_ref2_amount: form.commission_ref2_amount ? parseInt(form.commission_ref2_amount) : null,
      commission_ref2_fee:    form.commission_ref2_fee    ? parseInt(form.commission_ref2_fee)    : null,
    };
    if (editId === "new") {
      await supabase.from("mobile_money_accounts").insert({ ...payload, organization_id: orgId, balance: 0, currency: "XAF", is_active: true });
    } else {
      await supabase.from("mobile_money_accounts").update(payload).eq("id", editId);
    }
    setSaving(false);
    setEditId(null);
    load();
  }

  async function toggle(id: string, current: boolean) {
    await supabase.from("mobile_money_accounts").update({ is_active: !current }).eq("id", id);
    load();
  }

  const providerColor = (p: string) => p === "orange_money"
    ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>;

  return (
    <div className="space-y-3">
      <SectionTitle title="Comptes Mobile Money"
        action={editId !== "new" && <AddBtn onClick={startNew} label="Ajouter un compte" />} />

      {editId === "new" && (
        <Card>
          <p className="text-xs font-semibold text-[#075B32] uppercase tracking-wide mb-3">Nouveau compte</p>
          <MomoFormFields form={form} setForm={setForm} err={err} />
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
            </button>
            <button onClick={() => setEditId(null)}
              className="px-4 py-2 text-sm text-[#66736A] rounded-lg border border-[#E2E8E3]">Annuler</button>
          </div>
        </Card>
      )}

      {accounts.map(a => (
        <Card key={a.id}>
          {editId === a.id ? (
            <>
              <MomoFormFields form={form} setForm={setForm} err={err} />
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                </button>
                <button onClick={() => setEditId(null)}
                  className="px-4 py-2 text-sm text-[#66736A] rounded-lg border border-[#E2E8E3]">Annuler</button>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F5F7F5] flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-5 h-5 text-[#075B32]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-[#17231C]">{a.account_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${providerColor(a.provider)}`}>
                      {PROVIDER_LABELS[a.provider]}
                    </span>
                    {!a.is_active && <span className="text-xs text-red-500 font-medium">Inactif</span>}
                  </div>
                  <p className="text-xs text-[#A0ADA5] font-mono mt-0.5">{a.account_number}</p>
                  {a.owner_name && <p className="text-xs text-[#66736A] mt-0.5">Propriétaire : {a.owner_name}</p>}
                  {/* Commission résumé */}
                  {a.commission_ref1_amount && a.commission_ref2_amount && (
                    <p className="text-xs text-[#A0ADA5] mt-0.5">
                      Barème : {new Intl.NumberFormat("fr-CM").format(a.commission_ref1_amount)} F → {new Intl.NumberFormat("fr-CM").format(a.commission_ref1_fee ?? 0)} F  |  {new Intl.NumberFormat("fr-CM").format(a.commission_ref2_amount)} F → {new Intl.NumberFormat("fr-CM").format(a.commission_ref2_fee ?? 0)} F
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.qr_data && (
                    <button onClick={() => setShowQr(showQr === a.id ? null : a.id)}
                      className="p-1.5 text-[#A0ADA5] hover:text-[#075B32] rounded-lg transition-colors" title="QR Code">
                      <QrCode className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => startEdit(a)}
                    className="p-1.5 text-[#A0ADA5] hover:text-[#075B32] rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggle(a.id, a.is_active)}
                    className={`text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${a.is_active ? "text-[#A0ADA5] hover:text-red-500 border-[#E2E8E3]" : "text-green-600 hover:text-green-700 border-green-200"}`}>
                    {a.is_active ? "Désactiver" : "Activer"}
                  </button>
                </div>
              </div>
              {/* QR code panel */}
              {showQr === a.id && a.qr_data && (
                <div className="mt-3 pt-3 border-t border-[#E2E8E3] flex items-start gap-4">
                  <div className="bg-white p-2 rounded-lg border border-[#E2E8E3]">
                    <QRCodeSVG value={a.qr_data} size={96} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#17231C] mb-1">QR Code transaction</p>
                    <p className="text-xs text-[#A0ADA5] font-mono break-all">{a.qr_data}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}

      {accounts.length === 0 && editId !== "new" && (
        <div className="text-center py-12 text-[#A0ADA5]">
          <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun compte Mobile Money configuré</p>
        </div>
      )}
    </div>
  );
}

const selectCls = "w-full border border-[#E2E8E3] rounded-lg px-3 py-2 text-sm text-[#17231C] bg-white focus:outline-none focus:ring-2 focus:ring-[#075B32]";

function calcCommission(amount: number, r1a: number, r1f: number, r2a: number, r2f: number): number {
  if (r1a === r2a) return r1f;
  const fee = r1f + (amount - r1a) * (r2f - r1f) / (r2a - r1a);
  return Math.max(0, Math.round(fee));
}

function CommissionPreview({ form }: { form: typeof MOMO_EMPTY_FORM }) {
  const r1a = parseInt(form.commission_ref1_amount);
  const r1f = parseInt(form.commission_ref1_fee);
  const r2a = parseInt(form.commission_ref2_amount);
  const r2f = parseInt(form.commission_ref2_fee);
  if (!r1a || !r2a || isNaN(r1f) || isNaN(r2f) || r1a === r2a) return null;
  const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
  const amounts = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000].filter(a => a > 0);
  return (
    <div className="bg-[#F5F7F5] rounded-lg p-3">
      <p className="text-xs font-semibold text-[#17231C] mb-2">Barème calculé automatiquement</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {amounts.map(a => (
          <div key={a} className="flex justify-between text-xs">
            <span className="text-[#66736A]">{fmt(a)} F</span>
            <span className="font-medium text-[#17231C]">{fmt(calcCommission(a, r1a, r1f, r2a, r2f))} F</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MomoFormFields({ form, setForm, err }: {
  form: typeof MOMO_EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  err: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[#66736A] mb-1">Opérateur</label>
        <select value={form.provider} onChange={e => setForm((f: any) => ({ ...f, provider: e.target.value }))}
          className={selectCls}>
          <option value="orange_money">Orange Money</option>
          <option value="mtn_momo">MTN MoMo</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Numéro *</label>
          <input value={form.account_number} onChange={e => setForm((f: any) => ({ ...f, account_number: e.target.value }))}
            placeholder="6X XX XX XX" className={inputCls + " font-mono"} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Nom du compte *</label>
          <input value={form.account_name} onChange={e => setForm((f: any) => ({ ...f, account_name: e.target.value }))}
            placeholder="Nom affiché" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#66736A] mb-1">Propriétaire de la puce</label>
        <input value={form.owner_name} onChange={e => setForm((f: any) => ({ ...f, owner_name: e.target.value }))}
          placeholder="Jean Dupont" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#66736A] mb-1">Notes</label>
        <input value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
          placeholder="Usage, responsable…" className={inputCls} />
      </div>
      {/* QR Code */}
      <div className="border border-[#E2E8E3] rounded-lg p-3">
        <label className="block text-xs font-medium text-[#17231C] mb-1 flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5" /> QR Code transaction
        </label>
        <p className="text-xs text-[#A0ADA5] mb-2">Texte libre — numéro, lien de paiement, identifiant… Tout ce que vous saisissez génère un QR code.</p>
        <input value={form.qr_data} onChange={e => setForm((f: any) => ({ ...f, qr_data: e.target.value }))}
          placeholder="237655000001 ou lien de paiement…" className={inputCls} />
        {form.qr_data.trim() && (
          <div className="mt-3 flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg border border-[#E2E8E3]">
              <QRCodeSVG value={form.qr_data.trim()} size={80} />
            </div>
            <p className="text-xs text-[#A0ADA5]">Aperçu du QR code</p>
          </div>
        )}
      </div>
      {/* Barème commissions */}
      <div className="border border-[#E2E8E3] rounded-lg p-3">
        <p className="text-xs font-medium text-[#17231C] mb-1">Barème de commissions</p>
        <p className="text-xs text-[#A0ADA5] mb-3">Renseignez 2 références — le reste est calculé automatiquement par interpolation linéaire.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-[#66736A] mb-1">Référence 1 — Montant (F)</label>
            <input type="number" value={form.commission_ref1_amount} onChange={e => setForm((f: any) => ({ ...f, commission_ref1_amount: e.target.value }))}
              placeholder="5000" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#66736A] mb-1">Référence 1 — Commission (F)</label>
            <input type="number" value={form.commission_ref1_fee} onChange={e => setForm((f: any) => ({ ...f, commission_ref1_fee: e.target.value }))}
              placeholder="50" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#66736A] mb-1">Référence 2 — Montant (F)</label>
            <input type="number" value={form.commission_ref2_amount} onChange={e => setForm((f: any) => ({ ...f, commission_ref2_amount: e.target.value }))}
              placeholder="10000" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#66736A] mb-1">Référence 2 — Commission (F)</label>
            <input type="number" value={form.commission_ref2_fee} onChange={e => setForm((f: any) => ({ ...f, commission_ref2_fee: e.target.value }))}
              placeholder="85" className={inputCls} />
          </div>
        </div>
        <CommissionPreview form={form} />
      </div>
      {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
    </div>
  );
}

// ─── Comptes Tab ─────────────────────────────────────────────────────────────

type SecondaryAccount = {
  id: string;
  name: string;
  description: string | null;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  payment_method_link: string | null;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  reserve: "Réserve", coffre: "Coffre", epargne: "Épargne", autre: "Autre",
  cheque: "Chèque", virement: "Virement", marchand: "Marchand",
};

const EMPTY_SEC = { name: "", description: "", account_type: "reserve", current_balance: 0, payment_method_link: "" };

function ComptesTab({ orgId }: { orgId: string }) {
  const [registers, setRegisters]       = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [secondary, setSecondary]       = useState<SecondaryAccount[]>([]);
  const [loading, setLoading]           = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [form, setForm]                 = useState<typeof EMPTY_SEC>(EMPTY_SEC);
  const [saving, setSaving]             = useState(false);
  const [err, setErr]                   = useState("");

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const [{ data: regData }, { data: secData, error: secError }] = await Promise.all([
      supabase.from("cash_registers").select("id, name, is_active").eq("organization_id", orgId),
      supabase.from("secondary_accounts").select("id, name, description, account_type, current_balance, is_active, payment_method_link")
        .eq("organization_id", orgId).order("created_at"),
    ]);
    setRegisters(regData ?? []);
    if (secError?.code === "42P01") { setMigrationMissing(true); } // table n'existe pas encore
    else { setSecondary(secData ?? []); }
    setLoading(false);
  }

  function startNew() { setForm(EMPTY_SEC); setEditId("new"); setErr(""); }
  function startEdit(a: SecondaryAccount) {
    setForm({ name: a.name, description: a.description ?? "", account_type: a.account_type, current_balance: a.current_balance, payment_method_link: a.payment_method_link ?? "" });
    setEditId(a.id); setErr("");
  }

  async function save() {
    if (!form.name.trim()) { setErr("Le nom est requis"); return; }
    setSaving(true); setErr("");
    if (editId === "new") {
      const { error } = await supabase.from("secondary_accounts")
        .insert({ ...form, organization_id: orgId, name: form.name.trim() });
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("secondary_accounts")
        .update({ name: form.name.trim(), description: form.description || null, account_type: form.account_type, payment_method_link: form.payment_method_link || null })
        .eq("id", editId!);
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false); setEditId(null); load();
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("secondary_accounts").update({ is_active: !active }).eq("id", id);
    setSecondary(prev => prev.map(a => a.id === id ? { ...a, is_active: !active } : a));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>;

  return (
    <div className="space-y-6">
      {/* Compte principal */}
      <div>
        <h2 className="text-sm font-semibold text-[#17231C] mb-3">Compte principal</h2>
        <p className="text-xs text-[#A0ADA5] mb-3">
          Le compte principal est lié à la caisse physique. Il n'y en a toujours qu'un seul actif.
          Configurez la caisse dans l'onglet <strong>Caisses</strong>.
        </p>
        {registers.map(r => (
          <Card key={r.id}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#E8F3EC] flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-[#075B32]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[#17231C]">{r.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#E8F3EC] text-[#075B32]">Principal</span>
                  {!r.is_active && <span className="text-xs text-red-500 font-medium">Inactif</span>}
                </div>
                <p className="text-xs text-[#A0ADA5] mt-0.5">Caisse physique — solde calculé à la clôture</p>
              </div>
            </div>
          </Card>
        ))}
        {registers.length === 0 && (
          <p className="text-sm text-[#A0ADA5] text-center py-6">Aucune caisse configurée</p>
        )}
      </div>

      {/* Comptes secondaires */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#17231C]">Comptes secondaires</h2>
            <p className="text-xs text-[#A0ADA5] mt-0.5">Réserve, coffre, épargne — pour les virements inter-comptes</p>
          </div>
          {!migrationMissing && (
            <button onClick={startNew} disabled={editId === "new"}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          )}
        </div>

        {migrationMissing ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-700 mb-1">Migration 041 requise</p>
            <p className="text-xs text-amber-600">
              La table des comptes secondaires n'existe pas encore en base.
              Appliquez la migration <code>041_secondary_accounts.sql</code> pour activer cette fonctionnalité.
            </p>
          </div>
        ) : (
          <>
            {editId === "new" && (
              <Card>
                <SecondaryAccountForm form={form} setForm={setForm} err={err} />
                <div className="flex gap-2 mt-3">
                  <button onClick={save} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="px-4 py-2 text-sm text-[#66736A] rounded-lg border border-[#E2E8E3]">Annuler</button>
                </div>
              </Card>
            )}

            {secondary.map(a => (
              <Card key={a.id}>
                {editId === a.id ? (
                  <>
                    <SecondaryAccountForm form={form} setForm={setForm} err={err} />
                    <div className="flex gap-2 mt-3">
                      <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm rounded-lg hover:bg-[#063A22] disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="px-4 py-2 text-sm text-[#66736A] rounded-lg border border-[#E2E8E3]">Annuler</button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F5F7F5] flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5 text-[#66736A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-[#17231C]">{a.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F5F7F5] text-[#66736A]">
                          {ACCOUNT_TYPE_LABELS[a.account_type] ?? a.account_type}
                        </span>
                        {a.payment_method_link && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                            POS: {a.payment_method_link}
                          </span>
                        )}
                        {!a.is_active && <span className="text-xs text-red-500 font-medium">Inactif</span>}
                      </div>
                      {a.description && <p className="text-xs text-[#A0ADA5] mt-0.5 truncate">{a.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(a)}
                        className="p-1.5 text-[#A0ADA5] hover:text-[#075B32] rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggle(a.id, a.is_active)}
                        className={`text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${a.is_active ? "text-[#A0ADA5] hover:text-red-500 border-[#E2E8E3]" : "text-green-600 hover:text-green-700 border-green-200"}`}>
                        {a.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {secondary.length === 0 && editId !== "new" && (
              <div className="text-center py-10 text-[#A0ADA5]">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun compte secondaire configuré</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SecondaryAccountForm({ form, setForm, err }: {
  form: typeof EMPTY_SEC;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  err: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Nom *</label>
          <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
            placeholder="Réserve principale" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Type</label>
          <select value={form.account_type} onChange={e => setForm((f: any) => ({ ...f, account_type: e.target.value }))}
            className={selectCls}>
            <option value="reserve">Réserve</option>
            <option value="coffre">Coffre</option>
            <option value="epargne">Épargne</option>
            <option value="cheque">Chèque</option>
            <option value="virement">Virement</option>
            <option value="marchand">Marchand</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Description</label>
          <input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
            placeholder="Usage, responsable…" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#66736A] mb-1">Mode POS lié</label>
          <select value={form.payment_method_link || ""} onChange={e => setForm((f: any) => ({ ...f, payment_method_link: e.target.value || null }))}
            className={selectCls}>
            <option value="">Aucun</option>
            <option value="Orange Money">Orange Money</option>
            <option value="MTN MoMo">MTN MoMo</option>
            <option value="Chèque">Chèque</option>
            <option value="Virement">Virement</option>
          </select>
        </div>
      </div>
      {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
    </div>
  );
}

function HorairesTab({ orgId }: { orgId: string }) {
  const [schedule, setSchedule] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();
    if (data?.settings?.work_schedule) {
      setSchedule({ ...DEFAULT_SCHEDULE, ...data.settings.work_schedule });
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    // Merge into existing settings without overwriting other keys
    const { data: current } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    await supabase.from("organizations").update({
      settings: { ...(current?.settings ?? {}), work_schedule: schedule }
    }).eq("id", orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(jour: string, field: keyof DaySchedule, value: any) {
    setSchedule(s => ({ ...s, [jour]: { ...s[jour], [field]: value } }));
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>;

  return (
    <div className="space-y-4">
      <SectionTitle title="Horaires de travail du personnel" />

      <Card>
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs font-medium text-[#A0ADA5] uppercase tracking-wide pb-2 border-b border-[#F0F4F1]">
            <span>Jour</span>
            <span className="w-28 text-center">Heure d'ouverture</span>
            <span className="w-28 text-center">Heure de fermeture</span>
            <span className="w-16 text-center">Actif</span>
          </div>
          {JOURS.map(jour => {
            const d = schedule[jour] ?? { active: false, open: "08:00", close: "17:00" };
            return (
              <div key={jour}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-2.5 px-1 rounded-lg transition-colors ${d.active ? "" : "opacity-50"}`}>
                <span className="text-sm font-medium text-[#17231C]">{JOUR_LABELS[jour]}</span>
                <input type="time" value={d.open} onChange={e => update(jour, "open", e.target.value)}
                  disabled={!d.active}
                  className="w-28 border border-[#E2E8E3] rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#075B32] disabled:bg-[#F5F7F5] disabled:cursor-not-allowed" />
                <input type="time" value={d.close} onChange={e => update(jour, "close", e.target.value)}
                  disabled={!d.active}
                  className="w-28 border border-[#E2E8E3] rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#075B32] disabled:bg-[#F5F7F5] disabled:cursor-not-allowed" />
                <div className="w-16 flex justify-center">
                  <button onClick={() => update(jour, "active", !d.active)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${d.active ? "bg-[#075B32]" : "bg-[#D1D9D3]"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${d.active ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#075B32] text-white text-sm font-medium rounded-lg hover:bg-[#063A22] disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Enregistré !" : "Enregistrer les horaires"}
        </button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type TabKey = "membres" | "caisses" | "momo" | "horaires" | "flotte" | "comptes";

function FlotteTab({ orgId }: { orgId: string }) {
  const [settings, setSettings] = useState<FlotteSettings>(DEFAULT_FLOTTE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    if (data?.settings?.flotte) setSettings({ ...DEFAULT_FLOTTE, ...data.settings.flotte });
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const { data: current } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    await supabase.from("organizations").update({
      settings: { ...(current?.settings ?? {}), flotte: settings }
    }).eq("id", orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(provider: keyof FlotteSettings, field: keyof FlotteProvider, value: string | boolean) {
    setSettings(s => ({ ...s, [provider]: { ...s[provider], [field]: value } }));
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>;

  const providers: { key: keyof FlotteSettings; label: string; bg: string }[] = [
    { key: "orange_money", label: "Orange Money", bg: "bg-orange-50 border-orange-200" },
    { key: "mtn_momo",     label: "MTN MoMo",     bg: "bg-yellow-50  border-yellow-200" },
  ];

  return (
    <div className="space-y-5">
      <SectionTitle title="Paramètres de flotte Mobile Money"
        action={
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#075B32] text-white text-sm font-medium rounded-lg hover:bg-[#064d2a] disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Enregistré" : "Enregistrer"}
          </button>
        }
      />
      <p className="text-sm text-[#66736A] -mt-2 mb-1">
        Définissez les horaires de demande et de remboursement de flotte par opérateur.
      </p>

      {providers.map(({ key, label, bg }) => {
        const p = settings[key];
        return (
          <Card key={key}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${bg}`}>
                  <Signal className="w-5 h-5 text-[#075B32]" />
                </div>
                <span className="text-sm font-semibold text-[#17231C]">{label}</span>
              </div>
              <button onClick={() => update(key, "enabled", !p.enabled)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${p.enabled ? "bg-[#075B32]" : "bg-[#D1D9D4]"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${p.enabled ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {p.enabled ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#66736A] mb-1">Heure limite de demande</label>
                  <input type="time" value={p.request_deadline}
                    onChange={e => update(key, "request_deadline", e.target.value)}
                    className={timeCls} />
                  <p className="text-xs text-[#A0ADA5] mt-1">Après cette heure, aucune demande acceptée</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#66736A] mb-1">Heure limite de remboursement</label>
                  <input type="time" value={p.repayment_deadline}
                    onChange={e => update(key, "repayment_deadline", e.target.value)}
                    className={timeCls} />
                  <p className="text-xs text-[#A0ADA5] mt-1">La flotte doit être remboursée avant cette heure</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#A0ADA5] text-center py-2">Flotte désactivée pour cet opérateur</p>
            )}
          </Card>
        );
      })}

      <div className="bg-[#E8F3EC] rounded-lg p-4 flex gap-3">
        <Clock className="w-5 h-5 text-[#075B32] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[#17231C]">Fonctionnement de la flotte</p>
          <p className="text-xs text-[#66736A] mt-0.5">
            La flotte reçue doit être intégralement remboursée avant l'heure limite du même jour.
            Exemple : flotte reçue à 08h00 → remboursement avant 16h00.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PreferencesPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("membres");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .limit(1)
      .single()
      .then(({ data }) => {
        setOrgId(data?.organization_id ?? null);
        setLoadingOrg(false);
      });
  }, [session]);

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "membres",  label: "Membres",       icon: Users },
    { key: "caisses",  label: "Caisses",        icon: Banknote },
    { key: "momo",     label: "Mobile Money",   icon: Smartphone },
    { key: "comptes",  label: "Comptes",        icon: Wallet },
    { key: "horaires", label: "Horaires",       icon: Clock },
    { key: "flotte",   label: "Flotte",         icon: Signal },
  ];

  if (loadingOrg) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[#075B32]" />
    </div>
  );

  if (!orgId) return (
    <div className="p-6 text-center text-[#A0ADA5]">
      <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p>Aucune organisation associée à votre compte.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#17231C]">Préférences</h1>
        <p className="text-sm text-[#A0ADA5] mt-1">Gérez les membres, caisses, comptes, Mobile Money, horaires et flotte</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 flex-wrap mb-6">
        {tabs.map(t => (
          <Tab key={t.key} active={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            icon={t.icon} label={t.label} />
        ))}
      </div>

      {/* Contenu */}
      {activeTab === "membres"  && <MembresTab  orgId={orgId} />}
      {activeTab === "caisses"  && <CaissesTab  orgId={orgId} />}
      {activeTab === "momo"     && <MomoTab     orgId={orgId} />}
      {activeTab === "comptes"  && <ComptesTab  orgId={orgId} />}
      {activeTab === "horaires" && <HorairesTab orgId={orgId} />}
      {activeTab === "flotte"   && <FlotteTab   orgId={orgId} />}
    </div>
  );
}
