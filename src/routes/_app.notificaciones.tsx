import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/notificaciones")({
  ssr: false,
  component: Notificaciones,
});

function Notificaciones() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const notifsQ = useQuery({
    queryKey: ["notifs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });
  const data = notifsQ.data;

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notifs-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifs"] });
      })
      .subscribe();

    // mark as read on open
    supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).then();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  return (
    <AppShell title="Notificaciones" isFetching={notifsQ.isFetching}>
      {data && data.length > 0 ? (
        <div className="grid gap-2">
          {data.map((n) => (
            <Card key={n.id} className={`p-4 ${!n.is_read ? "border-brand" : ""}`}>
              <div className="flex items-start gap-2">
                {!n.is_read && <span className="size-2 rounded-full bg-brand mt-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {new Date(n.created_at).toLocaleString("es-PY")}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground">
          <Bell className="size-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No tenés notificaciones todavía.</p>
        </Card>
      )}
    </AppShell>
  );
}
