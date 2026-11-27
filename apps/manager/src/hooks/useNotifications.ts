import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  related_type: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { session, demoUser } = useAuth();
  // null in demo mode → all effects are no-ops
  const userId = demoUser ? null : (session?.user?.id ?? null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,related_type,related_id,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data as AppNotification[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Realtime : toute modification sur les notifications de cet utilisateur
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refetch,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refetch]);

  const markAsRead = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [userId]);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
