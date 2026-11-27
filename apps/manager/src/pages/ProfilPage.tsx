import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Camera, Edit2, Save, X, Phone, MapPin, Calendar,
  Briefcase, Mail, User, FileText, Shield, Loader2, Check
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

const ease = [0.22, 1, 0.36, 1] as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Administrateur", manager: "Gérant",
  secretary: "Secrétaire", accountant: "Comptable", member: "Employé", viewer: "Observateur",
};

type Profile = {
  full_name: string; phone: string | null; phone_secondary: string | null;
  address: string | null; city: string | null; country: string | null;
  date_of_birth: string | null; gender: string | null; bio: string | null;
  avatar_url: string | null;
};

function Avatar({ url, name, onUpload, uploading }: {
  url: string | null; name: string; onUpload: (file: File) => void; uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative w-28 h-28 group">
      {url ? (
        <img src={url} alt={name}
          className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-lg" />
      ) : (
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#075B32] to-[#063A22] flex items-center justify-center ring-4 ring-white shadow-lg">
          <span className="text-white text-3xl font-bold">{initials}</span>
        </div>
      )}
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
        aria-label="Changer la photo">
        {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }} />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#F5F7F5] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#075B32]" />
      </div>
      <div>
        <p className="text-xs text-[#A0ADA5] mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[#17231C]">{value}</p>
      </div>
    </div>
  );
}

export function ProfilPage() {
  const { session } = useAuth();
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [role, setRole]           = useState<string | null>(null);
  const [orgName, setOrgName]     = useState<string | null>(null);
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState<Profile | null>(null);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.from("user_roles").select("role, organizations(name)").eq("user_id", session.user.id).limit(1).single(),
    ]).then(([{ data: p }, { data: r }]) => {
      setProfile(p);
      setRole((r as any)?.role ?? null);
      setOrgName((r as any)?.organizations?.name ?? null);
      setLoading(false);
    });
  }, [session]);

  async function handleUpload(file: File) {
    if (!session?.user?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${session.user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", session.user.id);
    setProfile(p => p ? { ...p, avatar_url: publicUrl } : p);
    setUploading(false);
  }

  async function handleSave() {
    if (!draft || !session?.user?.id) return;
    setSaving(true);
    await supabase.from("profiles").update({
      full_name: draft.full_name,
      phone: draft.phone,
      phone_secondary: draft.phone_secondary,
      address: draft.address,
      city: draft.city,
      country: draft.country,
      date_of_birth: draft.date_of_birth || null,
      gender: draft.gender,
      bio: draft.bio,
    }).eq("id", session.user.id);
    setProfile(draft);
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#075B32]" />
      </div>
    );
  }

  const p = editing ? draft! : profile!;
  const displayName = p?.full_name || session?.user?.email || "Utilisateur";

  function Field({ label, field, type = "text" }: { label: string; field: keyof Profile; type?: string }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-[#17231C] mb-1 uppercase tracking-wide">{label}</label>
        <input
          type={type}
          value={(draft?.[field] as string) ?? ""}
          onChange={e => setDraft(d => d ? { ...d, [field]: e.target.value } : d)}
          className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="bg-gradient-to-r from-[#063A22] to-[#075B32] rounded-2xl p-8 relative overflow-hidden">
        {/* Décor */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 80% 50%, #D6A52B 0%, transparent 60%)"
        }} />
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar url={profile?.avatar_url ?? null} name={displayName} onUpload={handleUpload} uploading={uploading} />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-white text-2xl font-bold mb-1">{displayName}</h1>
            <p className="text-[#D6A52B] text-sm font-semibold mb-2">
              {ROLE_LABELS[role ?? ""] ?? role ?? "—"}
            </p>
            {orgName && (
              <p className="text-white/60 text-sm flex items-center gap-1 justify-center sm:justify-start">
                <Briefcase className="w-3.5 h-3.5" />{orgName}
              </p>
            )}
            {profile?.city && (
              <p className="text-white/50 text-xs flex items-center gap-1 mt-1 justify-center sm:justify-start">
                <MapPin className="w-3 h-3" />{profile.city}{profile.country ? `, ${profile.country}` : ""}
              </p>
            )}
          </div>

          {/* Badge role */}
          <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 self-start">
            <Shield className="w-4 h-4 text-[#D6A52B]" />
            <span className="text-white text-xs font-semibold">{ROLE_LABELS[role ?? ""] ?? "Utilisateur"}</span>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="relative z-10 text-white/60 text-sm mt-4 italic border-t border-white/10 pt-4">
            « {profile.bio} »
          </p>
        )}
      </motion.div>

      {/* Toast saved */}
      {saved && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <Check className="w-4 h-4" /> Profil sauvegardé
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Infos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.1 }}
          className="lg:col-span-1 bg-white rounded-2xl border border-[#E2E8E3] p-6">
          <h2 className="text-sm font-bold text-[#17231C] mb-4">Informations</h2>
          <div className="space-y-4">
            <InfoRow icon={Mail}     label="Email"     value={session?.user?.email} />
            <InfoRow icon={Phone}    label="Téléphone" value={profile?.phone} />
            <InfoRow icon={Phone}    label="Tél. sec." value={profile?.phone_secondary} />
            <InfoRow icon={MapPin}   label="Adresse"   value={profile?.address} />
            <InfoRow icon={MapPin}   label="Ville"     value={profile?.city} />
            <InfoRow icon={MapPin}   label="Pays"      value={profile?.country} />
            <InfoRow icon={Calendar} label="Naissance" value={profile?.date_of_birth ?? undefined} />
            <InfoRow icon={User}     label="Genre"
              value={profile?.gender === "male" ? "Homme" : profile?.gender === "female" ? "Femme" : profile?.gender ?? undefined} />
          </div>
        </motion.div>

        {/* Edit / Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.15 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8E3] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-[#17231C]">
              {editing ? "Modifier mon profil" : "Détails du profil"}
            </h2>
            {!editing ? (
              <button onClick={() => { setDraft({ ...profile! }); setEditing(true); }}
                className="flex items-center gap-2 text-sm text-[#075B32] hover:text-[#063A22] font-semibold border border-[#075B32]/30 px-3 py-1.5 rounded-lg hover:bg-[#E8F3EC] transition-colors">
                <Edit2 size={14} /> Modifier
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1 text-sm text-[#66736A] border border-[#E2E8E3] px-3 py-1.5 rounded-lg hover:bg-[#F5F7F5] transition-colors">
                  <X size={14} /> Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 text-sm text-white bg-[#075B32] hover:bg-[#063A22] px-3 py-1.5 rounded-lg disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Prénom et Nom" field="full_name" />
              <Field label="Téléphone principal" field="phone" type="tel" />
              <Field label="Téléphone secondaire" field="phone_secondary" type="tel" />
              <Field label="Ville" field="city" />
              <Field label="Pays" field="country" />
              <Field label="Adresse" field="address" />
              <Field label="Date de naissance" field="date_of_birth" type="date" />
              <div>
                <label className="block text-xs font-semibold text-[#17231C] mb-1 uppercase tracking-wide">Genre</label>
                <select value={draft?.gender ?? ""}
                  onChange={e => setDraft(d => d ? { ...d, gender: e.target.value } : d)}
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 appearance-none">
                  <option value="">—</option>
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#17231C] mb-1 uppercase tracking-wide">Bio</label>
                <textarea value={draft?.bio ?? ""} rows={3}
                  onChange={e => setDraft(d => d ? { ...d, bio: e.target.value } : d)}
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl bg-white focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 resize-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Rôle", value: ROLE_LABELS[role ?? ""] ?? "—", icon: Shield },
                  { label: "Agence", value: orgName ?? "—", icon: Briefcase },
                  { label: "Email vérifié", value: session?.user?.email_confirmed_at ? "Oui" : "Non", icon: Check },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-[#F5F7F5] rounded-xl p-3 text-center">
                    <Icon className="w-4 h-4 text-[#075B32] mx-auto mb-1" />
                    <p className="text-xs text-[#A0ADA5] mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-[#17231C] truncate">{value}</p>
                  </div>
                ))}
              </div>

              {profile?.bio && (
                <div className="bg-[#F5F7F5] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#075B32]" />
                    <span className="text-xs font-semibold text-[#17231C]">Bio</span>
                  </div>
                  <p className="text-sm text-[#66736A] italic">« {profile.bio} »</p>
                </div>
              )}

              {!profile?.phone && !profile?.city && !profile?.bio && (
                <div className="text-center py-8 text-[#A0ADA5]">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Profil incomplet — cliquez sur Modifier pour l'enrichir.</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
