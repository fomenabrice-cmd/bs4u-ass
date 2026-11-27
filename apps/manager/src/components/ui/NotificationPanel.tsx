import { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, ShoppingCart, Banknote, Smartphone, FileText,
  TrendingUp, AlertTriangle, CheckCheck, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { AppNotification } from "../../hooks/useNotifications";

interface Props {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

function notifIcon(type: string) {
  if (type.includes("order") || type.includes("commande")) return ShoppingCart;
  if (type.includes("momo") || type.includes("mobile")) return Smartphone;
  if (type.includes("document")) return FileText;
  if (type.includes("invoice") || type.includes("facture") || type.includes("payment") || type.includes("paiement")) return Banknote;
  if (type.includes("stock") || type.includes("alert")) return AlertTriangle;
  if (type.includes("finance") || type.includes("tresor")) return TrendingUp;
  return Bell;
}

function getRoute(related_type: string | null, related_id: string | null): string | null {
  if (!related_type) return null;
  switch (related_type) {
    case "order":          return related_id ? `/commandes/${related_id}` : "/commandes";
    case "invoice":        return "/finance/factures";
    case "payment":        return "/finance/encaissements";
    case "momo_operation": return "/mobile-money";
    case "document":       return related_id ? `/secretariat/${related_id}` : "/secretariat";
    case "contact":        return related_id ? `/clients/${related_id}` : "/clients";
    case "product":        return related_id ? `/produits/${related_id}` : "/produits";
    default:               return null;
  }
}

export function NotificationPanel({
  open, onToggle, onClose,
  notifications, unreadCount, loading,
  markAsRead, markAllAsRead,
}: Props) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const handleNotifClick = async (n: AppNotification) => {
    if (!n.is_read) await markAsRead(n.id);
    const route = getRoute(n.related_type, n.related_id);
    if (route) { navigate(route); onClose(); }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bouton cloche */}
      <button
        onClick={onToggle}
        className="relative p-2 text-[#66736A] hover:text-[#17231C] rounded-lg hover:bg-[#F5F7F5] transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 bg-[#B42318] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panneau déroulant */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-[#E2E8E3] z-40 overflow-hidden">
          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8E3]">
            <span className="text-sm font-semibold text-[#17231C]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-[#075B32] hover:text-[#063A22] font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#F0F3F1]">
            {loading && (
              <div className="flex items-center justify-center py-8 text-[#66736A]">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-[#C5D0C8] mx-auto mb-2" />
                <p className="text-sm text-[#66736A]">Aucune notification</p>
              </div>
            )}

            {!loading && notifications.map(n => {
              const Icon = notifIcon(n.type);
              const hasRoute = !!getRoute(n.related_type, n.related_id);
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  role={hasRoute ? "button" : undefined}
                  tabIndex={hasRoute ? 0 : undefined}
                  onKeyDown={hasRoute ? e => e.key === "Enter" && handleNotifClick(n) : undefined}
                  className={`flex gap-3 px-4 py-3 transition-colors ${
                    hasRoute ? "cursor-pointer hover:bg-[#F5F7F5]" : ""
                  } ${!n.is_read ? "bg-[#F0F9F4]" : ""}`}
                >
                  {/* Icône */}
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    !n.is_read ? "bg-[#DCF0E5]" : "bg-[#F5F7F5]"
                  }`}>
                    <Icon className={`w-4 h-4 ${!n.is_read ? "text-[#075B32]" : "text-[#66736A]"}`} />
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-[#17231C]" : "font-medium text-[#3D4E45]"}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-[#075B32] shrink-0" aria-label="Non lue" />
                      )}
                    </div>
                    <p className="text-xs text-[#66736A] mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-[#9AA79F] mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pied de panneau */}
          {notifications.length > 0 && (
            <div className="border-t border-[#E2E8E3] px-4 py-2.5 text-center">
              <p className="text-xs text-[#9AA79F]">{notifications.length} notification{notifications.length > 1 ? "s" : ""} affichée{notifications.length > 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
