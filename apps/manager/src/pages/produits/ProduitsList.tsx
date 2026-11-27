import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Package, AlertTriangle, Edit2, X, Printer, Barcode,
  LayoutGrid, Loader2, ImagePlus, ChevronRight, Eye, CheckCircle, Folder, Trash2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { BarcodeDisplay } from "../../components/ui/BarcodeDisplay";
import { PrintPreviewModal } from "../../components/ui/PrintPreviewModal";
import { buildCatalogueA4, buildLabelsA4 } from "../../utils/printUtils";

const ease = [0.22, 1, 0.36, 1] as const;

type Category = { id: string; name: string };
type Product = {
  id: string; sku: string | null; barcode: string | null;
  name: string; description: string | null; unit: string | null;
  unit_price: number; cost_price: number | null;
  min_stock: number; track_stock: boolean;
  image_url: string | null; is_active: boolean;
  category_id: string | null;
  product_categories: { name: string } | null;
  inventory: { quantity: number; reserved_qty: number }[];
};

function qty(p: Product) { return p.inventory[0]?.quantity ?? 0; }

type FormState = {
  sku: string; name: string; description: string; category_id: string;
  unit_price: string; cost_price: string; unit: string;
  min_stock: string; track_stock: boolean; is_active: boolean;
  imageFile: File | null; imagePreview: string | null;
};

const EMPTY_FORM = (): FormState => ({
  sku: "", name: "", description: "", category_id: "",
  unit_price: "", cost_price: "", unit: "unité",
  min_stock: "5", track_stock: false, is_active: true,
  imageFile: null, imagePreview: null,
});

export function ProduitsList() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("Toutes");
  const [sheet,     setSheet]     = useState<Product | null>(null);
  const [editModal, setEditModal] = useState<Product | "new" | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM());
  const [saving,    setSaving]    = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string; paper: "80mm" | "A4" } | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  type BulkRow = { name: string; sku: string; category_id: string; unit_price: string; cost_price: string; unit: string; track_stock: boolean };
  const emptyRow = (): BulkRow => ({ name: "", sku: "", category_id: "", unit_price: "", cost_price: "", unit: "unité", track_stock: false });
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"produits" | "categories">("produits");
  const [catModal, setCatModal] = useState<{ id?: string; name: string } | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  async function load() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products")
        .select("*, product_categories(name), inventory(quantity, reserved_qty)")
        .order("name"),
      supabase.from("product_categories").select("id, name").order("name"),
    ]);
    setProducts((prods ?? []) as Product[]);
    setCategories((cats ?? []) as Category[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const catNames = ["Toutes", ...categories.map(c => c.name)];
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
    const matchC = catFilter === "Toutes" || p.product_categories?.name === catFilter;
    return matchQ && matchC;
  });

  const alertCount  = products.filter(p => p.track_stock && qty(p) <= p.min_stock).length;
  const totalValeur = products.reduce((s, p) => s + (p.cost_price ?? 0) * qty(p), 0);

  function openAdd() { setForm(EMPTY_FORM()); setEditModal("new"); }
  function openEdit(p: Product) {
    setForm({
      sku: p.sku ?? "", name: p.name, description: p.description ?? "",
      category_id: p.category_id ?? "", unit_price: String(p.unit_price),
      cost_price: String(p.cost_price ?? ""), unit: p.unit ?? "unité",
      min_stock: String(p.min_stock), track_stock: p.track_stock,
      is_active: p.is_active, imageFile: null, imagePreview: p.image_url,
    });
    setEditModal(p);
  }

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    let image_url: string | undefined;
    if (form.imageFile) {
      const ext = form.imageFile.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { data: up } = await supabase.storage.from("product-images").upload(path, form.imageFile, { upsert: true });
      if (up) {
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(up.path);
        image_url = publicUrl;
      }
    }
    const payload = {
      sku: form.sku || null,
      name: form.name,
      description: form.description || null,
      category_id: form.category_id || null,
      unit_price: parseInt(form.unit_price) || 0,
      cost_price: parseInt(form.cost_price) || 0,
      unit: form.unit || "unité",
      min_stock: parseInt(form.min_stock) || 0,
      track_stock: form.track_stock,
      is_active: form.is_active,
      ...(image_url ? { image_url } : {}),
    };
    if (editModal === "new") {
      await supabase.from("products").insert(payload);
    } else if (editModal) {
      await supabase.from("products").update(payload).eq("id", (editModal as Product).id);
    }
    setSaving(false);
    setEditModal(null);
    load();
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setForm(v => ({ ...v, imageFile: f, imagePreview: URL.createObjectURL(f) }));
  }

  function setB(i: number, k: keyof BulkRow, v: string | boolean) {
    setBulkRows(rows => rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  }

  async function saveCategory() {
    if (!catModal?.name.trim()) return;
    setCatSaving(true);
    if (catModal.id) {
      await supabase.from("product_categories").update({ name: catModal.name.trim() }).eq("id", catModal.id);
    } else {
      await supabase.from("product_categories").insert({ name: catModal.name.trim() });
    }
    setCatSaving(false);
    setCatModal(null);
    load();
  }

  async function deleteCategory(id: string) {
    if (products.some(p => p.category_id === id)) return; // protégé : des produits l'utilisent
    await supabase.from("product_categories").delete().eq("id", id);
    load();
  }

  async function saveBulk() {
    const valid = bulkRows.filter(r => r.name.trim());
    if (!valid.length) return;
    setBulkSaving(true);
    await supabase.from("products").insert(valid.map(r => ({
      name: r.name.trim(),
      sku: r.sku.toUpperCase() || null,
      category_id: r.category_id || null,
      unit_price: parseInt(r.unit_price) || 0,
      cost_price: parseInt(r.cost_price) || 0,
      unit: r.unit || "unité",
      track_stock: r.track_stock,
      is_active: true,
    })));
    setBulkSaving(false);
    setBulkModal(false);
    setBulkRows([emptyRow(), emptyRow(), emptyRow()]);
    load();
  }

  function printBarcode(p: Product) {
    const ref = p.sku ?? p.id.slice(0, 8);
    const bars: number[] = [];
    for (let i = 0; i < ref.length; i++) {
      const c = ref.charCodeAt(i);
      bars.push(1 + (c & 1)); bars.push(1 + ((c >> 2) & 1));
      bars.push(1 + ((c >> 4) & 1)); bars.push(1 + ((c >> 6) & 1));
    }
    const all = [2, ...bars, 2];
    let x = 0;
    const rects = all.map((w, i) => { const r = i % 2 === 0 ? `<rect x="${x.toFixed(1)}" y="0" width="${(w * 1.5).toFixed(1)}" height="48" fill="black"/>` : ""; x += w * 1.5; return r; }).join("");
    const svgW = x.toFixed(1);
    const html = `<div style="text-align:center;padding:16px"><strong style="font-size:14px">${p.name}</strong><br><span style="font-size:11px;color:#666">Réf : ${ref}</span><br><br><svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="48" style="display:block;margin:4px auto">${rects}</svg><span style="font-family:monospace;font-size:9px;letter-spacing:.08em">${ref}</span><div style="margin-top:12px;font-size:11px;color:#333">Prix : ${p.unit_price.toLocaleString("fr-FR")} FCFA</div></div>`;
    setBarcodeProduct(null);
    setPrintPreview({ html, title: `Étiquette ${ref}`, paper: "80mm" });
  }

  function printCatalogue() {
    const html = buildCatalogueA4(products.map(p => ({
      ref: p.sku ?? "—", nom: p.name, categorie: p.product_categories?.name ?? "—",
      prixVente: p.unit_price, prixMembre: p.unit_price,
      stock: qty(p), unite: p.unit ?? "unité",
    })));
    setPrintPreview({ html, title: "Catalogue produits", paper: "A4" });
  }

  function printAllLabels() {
    const items = products.flatMap(p =>
      Array.from({ length: qtys[p.id] ?? 1 }, () => ({
        ref: p.sku ?? "—", nom: p.name,
        prixVente: p.unit_price, prixMembre: p.unit_price,
      }))
    );
    setShowLabels(false);
    setPrintPreview({ html: buildLabelsA4(items), title: "Étiquettes produits", paper: "A4" });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Catalogue produits</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{products.length} références · {alertCount} alerte(s) stock</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowLabels(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
            <LayoutGrid size={15} /> Toutes les étiquettes
          </button>
          <button onClick={printCatalogue}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
            <Printer size={15} /> Imprimer catalogue A4
          </button>
          <button onClick={() => { setBulkRows([emptyRow(), emptyRow(), emptyRow()]); setBulkModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#075B32] text-[#075B32] text-sm font-semibold hover:bg-[#E8F3EC] transition-colors">
            <Plus size={15} /> Création multiple
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#075B32] text-white text-sm font-semibold hover:bg-[#063A22] transition-colors">
            <Plus size={15} /> Nouveau produit
          </button>
        </div>
      </motion.div>

      {/* Onglets */}
      <div className="flex gap-1 bg-[#F5F7F5] rounded-xl p-1 w-fit">
        {(["produits", "categories"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? "bg-white text-[#17231C] shadow-sm" : "text-[#66736A] hover:text-[#17231C]"}`}>
            {tab === "produits" ? "Produits" : "Catégories"}
          </button>
        ))}
      </div>

      {/* ── ONGLET CATÉGORIES ── */}
      {activeTab === "categories" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}
          className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E3]">
            <div className="flex items-center gap-2">
              <Folder size={16} className="text-[#075B32]" />
              <h3 className="font-semibold text-[#17231C]">Catégories de produits</h3>
              <span className="text-xs bg-[#F5F7F5] text-[#66736A] px-2 py-0.5 rounded-full">{categories.length}</span>
            </div>
            <button onClick={() => setCatModal({ name: "" })}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#075B32] text-white text-xs font-semibold hover:bg-[#063A22] transition-colors">
              <Plus size={13} /> Nouvelle catégorie
            </button>
          </div>
          {categories.length === 0 ? (
            <div className="py-16 text-center text-[#A0ADA5] text-sm">
              <Folder size={32} className="mx-auto mb-3 text-[#E2E8E3]" />
              Aucune catégorie — créez-en une pour organiser vos produits
            </div>
          ) : (
            <ul className="divide-y divide-[#F5F7F5]">
              {categories.map(cat => {
                const count = products.filter(p => p.category_id === cat.id).length;
                return (
                  <li key={cat.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F5F7F5] transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#E8F3EC] flex items-center justify-center flex-shrink-0">
                        <Folder size={14} className="text-[#075B32]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#17231C]">{cat.name}</p>
                        <p className="text-xs text-[#A0ADA5]">{count} produit{count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setCatModal({ id: cat.id, name: cat.name })}
                        className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#A0ADA5] hover:bg-white hover:text-[#075B32] transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} disabled={count > 0}
                        title={count > 0 ? `${count} produit(s) utilisent cette catégorie` : "Supprimer"}
                        className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#A0ADA5] hover:bg-white hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{display: activeTab === "produits" ? undefined : "none"}}>
        {[
          { label: "Références",    value: products.length,                                                   color: "#075B32", bg: "#E8F3EC", icon: Package      },
          { label: "Alertes stock", value: alertCount,                                                        color: "#D97757", bg: "#FEF3EE", icon: AlertTriangle },
          { label: "Valeur stock",  value: `${(totalValeur / 1000).toFixed(0)}K FCFA`,                       color: "#1E40AF", bg: "#EFF6FF", icon: Package      },
          { label: "Actifs",        value: products.filter(p => p.is_active).length,                         color: "#6D28D9", bg: "#F5F3FF", icon: CheckCircle  },
        ].map(({ label, value, color, bg, icon: Icon }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease, delay: i * 0.07 }}
            className="rounded-2xl p-4 border border-black/5 shadow-sm" style={{ backgroundColor: bg }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${color}18` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-[#66736A] mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap items-center" style={{display: activeTab === "produits" ? undefined : "none"}}>
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0CCC4]" />
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {catNames.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${catFilter === cat ? "bg-[#075B32] text-white" : "bg-[#F5F7F5] text-[#66736A] hover:bg-[#E8F3EC]"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.3 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden" style={{display: activeTab === "produits" ? undefined : "none"}}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F7F5]">
                  {["Photo","Réf.","Produit","Catégorie","Code-barres","Prix vente","Stock","État",""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F7F5]">
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-16 text-[#A0ADA5] text-sm">Aucun produit</td></tr>
                )}
                {filtered.map((p, i) => {
                  const q = qty(p);
                  const alert = p.track_stock && q <= p.min_stock;
                  const out   = p.track_stock && q <= 0;
                  return (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`hover:bg-[#F5F7F5] transition-colors cursor-pointer ${alert ? "bg-red-50/30" : ""}`}
                      onClick={() => setSheet(p)}>
                      <td className="px-4 py-3">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-xl object-cover border border-[#E2E8E3]" />
                          : <div className="w-10 h-10 rounded-xl bg-[#F5F7F5] flex items-center justify-center"><Package size={16} className="text-[#C0CCC4]" /></div>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#A0ADA5]">{p.sku ?? "—"}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[#17231C] max-w-[180px]">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-[#F5F7F5] text-[#66736A] px-2 py-0.5 rounded-full">{p.product_categories?.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {p.sku ? <BarcodeDisplay code={p.sku} height={32} showText={false} /> : <span className="text-[#C0CCC4] text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#075B32] tabular-nums whitespace-nowrap">
                        {p.unit_price.toLocaleString("fr-FR")} FCFA
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-[#17231C]">
                        {p.track_stock ? `${q} ${p.unit ?? ""}` : <span className="text-[#C0CCC4] text-xs">illimité</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!p.is_active ? <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">Inactif</span>
                        : out        ? <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">Rupture</span>
                        : alert      ? <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-medium">⚠ Faible</span>
                        :              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">OK</span>}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setBarcodeProduct(p)}
                            className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#A0ADA5] hover:bg-[#F5F7F5] hover:text-[#075B32] transition-colors">
                            <Barcode size={13} />
                          </button>
                          <button onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#A0ADA5] hover:bg-[#F5F7F5] hover:text-[#075B32] transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setSheet(p)}
                            className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#A0ADA5] hover:bg-[#F5F7F5] hover:text-[#075B32] transition-colors">
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── FICHE PRODUIT ── */}
      <AnimatePresence>
        {sheet && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32 }} transition={{ duration: 0.25, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-[#17231C]">
              <div className="relative">
                {sheet.image_url
                  ? <img src={sheet.image_url} alt={sheet.name} className="w-full h-48 object-cover rounded-t-3xl" />
                  : <div className="w-full h-32 rounded-t-3xl bg-gradient-to-br from-[#E8F3EC] to-[#F5F7F5] flex items-center justify-center"><Package size={40} className="text-[#C0CCC4]" /></div>
                }
                <button onClick={() => setSheet(null)}
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md text-[#66736A] hover:text-[#17231C]">
                  <X size={16} />
                </button>
                <button onClick={() => { setSheet(null); openEdit(sheet); }}
                  className="absolute top-3 right-12 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md text-[#66736A] hover:text-[#17231C]">
                  <Edit2 size={16} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xl font-bold text-[#17231C]">{sheet.name}</h2>
                    {sheet.is_active
                      ? <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">Actif</span>
                      : <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">Inactif</span>
                    }
                  </div>
                  {sheet.product_categories && (
                    <span className="text-xs text-[#66736A] mt-1 inline-block">{sheet.product_categories.name}</span>
                  )}
                  {sheet.description && <p className="text-sm text-[#66736A] mt-2 leading-relaxed">{sheet.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#E8F3EC] rounded-2xl p-4">
                    <p className="text-xs text-[#66736A]">Prix de vente</p>
                    <p className="text-xl font-bold text-[#075B32] tabular-nums">{sheet.unit_price.toLocaleString("fr-FR")}<span className="text-xs ml-1">FCFA</span></p>
                  </div>
                  {sheet.cost_price != null && (
                    <div className="bg-[#F5F7F5] rounded-2xl p-4">
                      <p className="text-xs text-[#66736A]">Prix d'achat</p>
                      <p className="text-xl font-bold text-[#17231C] tabular-nums">{sheet.cost_price.toLocaleString("fr-FR")}<span className="text-xs ml-1">FCFA</span></p>
                      <p className="text-xs text-[#A0ADA5] mt-0.5">
                        Marge : {sheet.unit_price > 0 ? Math.round((sheet.unit_price - sheet.cost_price) / sheet.unit_price * 100) : 0}%
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-[#F5F7F5] rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#66736A]">Référence (SKU)</span>
                    <span className="font-mono font-semibold text-[#17231C]">{sheet.sku ?? "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#66736A]">Unité</span>
                    <span className="text-[#17231C]">{sheet.unit ?? "—"}</span>
                  </div>
                  {sheet.track_stock && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#66736A]">Stock actuel</span>
                        <span className={`font-bold tabular-nums ${qty(sheet) <= 0 ? "text-red-600" : qty(sheet) <= sheet.min_stock ? "text-orange-600" : "text-[#075B32]"}`}>
                          {qty(sheet)} {sheet.unit ?? ""}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#66736A]">Seuil d'alerte</span>
                        <span className="text-[#17231C]">{sheet.min_stock} {sheet.unit ?? ""}</span>
                      </div>
                    </>
                  )}
                </div>

                {sheet.sku && (
                  <div className="flex flex-col items-center gap-2 bg-[#F5F7F5] rounded-2xl p-4">
                    <BarcodeDisplay code={sheet.sku} height={48} showText />
                    <button onClick={() => { setSheet(null); printBarcode(sheet); }}
                      className="text-xs text-[#075B32] hover:underline flex items-center gap-1 mt-1">
                      <Printer size={12} /> Imprimer étiquette
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL Ajout / Édition ── */}
      <AnimatePresence>
        {editModal !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{editModal === "new" ? "Nouveau produit" : "Modifier le produit"}</h3>
                <button onClick={() => setEditModal(null)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>

              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-[#F5F7F5] flex items-center justify-center overflow-hidden border border-[#E2E8E3] flex-shrink-0 cursor-pointer hover:bg-[#E8F3EC] transition-colors" onClick={() => fileRef.current?.click()}>
                  {form.imagePreview
                    ? <img src={form.imagePreview} alt="" className="w-full h-full object-cover" />
                    : <ImagePlus size={24} className="text-[#C0CCC4]" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-[#17231C]">Photo du produit</p>
                  <button onClick={() => fileRef.current?.click()} className="text-xs text-[#075B32] hover:underline mt-0.5">
                    {form.imagePreview ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Référence (SKU)</label>
                  <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))}
                    placeholder="ex. PAP-A4-80G"
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Catégorie</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30">
                    <option value="">— Aucune —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Nom du produit *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nom complet du produit"
                  className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Description</label>
                <textarea value={form.description} rows={2} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description, spécifications…"
                  className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Prix de vente (FCFA) *</label>
                  <input type="number" min={0} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Prix d'achat (FCFA)</label>
                  <input type="number" min={0} value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Unité</label>
                  <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="unité, kg…"
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Seuil alerte</label>
                  <input type="number" min={0} value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.track_stock} onChange={e => setForm(f => ({ ...f, track_stock: e.target.checked }))}
                      className="w-4 h-4 accent-[#075B32]" />
                    <span className="text-xs font-medium text-[#17231C]">Suivi stock</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-[#075B32]" />
                    <span className="text-xs font-medium text-[#17231C]">Actif</span>
                  </label>
                </div>
              </div>

              {form.sku && (
                <div className="bg-[#F5F7F5] rounded-2xl p-4 flex flex-col items-center gap-2">
                  <p className="text-xs text-[#66736A]">Aperçu code-barres</p>
                  <BarcodeDisplay code={form.sku} height={40} showText />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditModal(null)}
                  className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={!form.name || saving}
                  className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold hover:bg-[#063A22] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editModal === "new" ? "Créer le produit" : "Enregistrer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL étiquettes ── */}
      <AnimatePresence>
        {showLabels && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] text-[#17231C]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E3]">
                <h3 className="font-bold text-lg">Étiquettes A4</h3>
                <button onClick={() => setShowLabels(false)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-6">
                <div className="bg-[#F5F7F5] rounded-2xl p-5 border border-dashed border-[#C0CCC4]">
                  <div className="grid grid-cols-3 gap-3">
                    {products.map(p => (
                      <div key={p.id} className="bg-white border border-[#E2E8E3] rounded-lg p-2 flex flex-col items-center gap-1 shadow-sm">
                        <p className="text-[10px] font-semibold text-[#17231C] text-center leading-tight truncate w-full">{p.name}</p>
                        {p.sku && <BarcodeDisplay code={p.sku} height={32} showText />}
                        <p className="text-[9px] text-[#075B32] font-bold">{p.unit_price.toLocaleString("fr-FR")} FCFA</p>
                        <div className="flex items-center gap-1 mt-1">
                          <button onClick={() => setQtys(q => ({ ...q, [p.id]: Math.max(1, (q[p.id] ?? 1) - 1) }))} className="w-5 h-5 rounded bg-[#F5F7F5] text-xs font-bold hover:bg-[#E8F3EC] flex items-center justify-center">−</button>
                          <span className="text-[10px] font-bold w-5 text-center">{qtys[p.id] ?? 1}</span>
                          <button onClick={() => setQtys(q => ({ ...q, [p.id]: (q[p.id] ?? 1) + 1 }))} className="w-5 h-5 rounded bg-[#F5F7F5] text-xs font-bold hover:bg-[#E8F3EC] flex items-center justify-center">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-[#E2E8E3]">
                <button onClick={() => setShowLabels(false)} className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">Fermer</button>
                <button onClick={() => { setShowLabels(false); printAllLabels(); }} className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#063A22] transition-colors">
                  <Printer size={15} /> Imprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL code-barres ── */}
      <AnimatePresence>
        {barcodeProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 space-y-4 text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Code-barres</h3>
                <button onClick={() => setBarcodeProduct(null)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>
              <div className="text-center space-y-1 py-2">
                <p className="text-sm font-medium">{barcodeProduct.name}</p>
                <p className="text-xs text-[#A0ADA5]">Réf. {barcodeProduct.sku ?? "—"}</p>
                {barcodeProduct.sku && <div className="flex justify-center mt-4"><BarcodeDisplay code={barcodeProduct.sku} height={56} showText /></div>}
              </div>
              <button onClick={() => printBarcode(barcodeProduct)}
                className="w-full py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#063A22] transition-colors">
                <Printer size={15} /> Imprimer étiquette 80mm
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {printPreview && (
          <PrintPreviewModal html={printPreview.html} title={printPreview.title} paper={printPreview.paper} onClose={() => setPrintPreview(null)} />
        )}
      </AnimatePresence>

      {/* ── MODAL Catégorie ── */}
      <AnimatePresence>
        {catModal !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{catModal.id ? "Modifier la catégorie" : "Nouvelle catégorie"}</h3>
                <button onClick={() => setCatModal(null)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Nom de la catégorie *</label>
                <input autoFocus type="text" value={catModal.name}
                  onChange={e => setCatModal(m => m ? { ...m, name: e.target.value } : m)}
                  onKeyDown={e => e.key === "Enter" && saveCategory()}
                  placeholder="ex. Fournitures, Impression…"
                  className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setCatModal(null)}
                  className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
                  Annuler
                </button>
                <button onClick={saveCategory} disabled={!catModal.name.trim() || catSaving}
                  className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold hover:bg-[#063A22] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {catSaving && <Loader2 size={14} className="animate-spin" />}
                  {catModal.id ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL Création multiple ── */}
      <AnimatePresence>
        {bulkModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] text-[#17231C]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E3]">
                <div>
                  <h3 className="font-bold text-lg">Création multiple de produits</h3>
                  <p className="text-xs text-[#66736A] mt-0.5">Remplissez au moins le nom — les lignes vides sont ignorées</p>
                </div>
                <button onClick={() => setBulkModal(false)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-6 space-y-2">
                <div className="grid grid-cols-7 gap-2 text-[10px] font-semibold text-[#66736A] uppercase tracking-wide px-1 mb-1">
                  <span className="col-span-2">Nom *</span><span>SKU</span><span>Catégorie</span>
                  <span>Prix vente</span><span>Prix achat</span><span>Unité</span>
                </div>
                {bulkRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-7 gap-2 items-center">
                    <input className="col-span-2 px-3 py-2 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30"
                      placeholder={`Produit ${i + 1}`} value={row.name}
                      onChange={e => setB(i, "name", e.target.value)} />
                    <input className="px-3 py-2 border border-[#E2E8E3] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#075B32]/30"
                      placeholder="REF" value={row.sku}
                      onChange={e => setB(i, "sku", e.target.value.toUpperCase())} />
                    <select className="px-2 py-2 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30"
                      value={row.category_id} onChange={e => setB(i, "category_id", e.target.value)}>
                      <option value="">—</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="number" className="px-3 py-2 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30"
                      placeholder="0" value={row.unit_price}
                      onChange={e => setB(i, "unit_price", e.target.value)} />
                    <input type="number" className="px-3 py-2 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30"
                      placeholder="0" value={row.cost_price}
                      onChange={e => setB(i, "cost_price", e.target.value)} />
                    <div className="flex items-center gap-1">
                      <input className="flex-1 px-2 py-2 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30"
                        placeholder="unité" value={row.unit}
                        onChange={e => setB(i, "unit", e.target.value)} />
                      <button onClick={() => setBulkRows(r => r.filter((_, j) => j !== i))}
                        className="p-1.5 text-[#C0CCC4] hover:text-red-500 transition-colors flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setBulkRows(r => [...r, emptyRow()])}
                  className="flex items-center gap-1.5 text-sm text-[#075B32] hover:underline mt-3">
                  <Plus size={14} /> Ajouter une ligne
                </button>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-[#E2E8E3]">
                <button onClick={() => setBulkModal(false)} className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">Annuler</button>
                <button onClick={saveBulk} disabled={bulkSaving || !bulkRows.some(r => r.name.trim())}
                  className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#063A22] transition-colors disabled:opacity-40">
                  {bulkSaving && <Loader2 size={14} className="animate-spin" />}
                  Enregistrer {bulkRows.filter(r => r.name.trim()).length} produit(s)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

