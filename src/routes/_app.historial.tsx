import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { formatDateTimeAR, formatGs } from "@/lib/format";
import { Clock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/historial")({
  ssr: false,
  component: Historial,
});

function Historial() {
  const { user } = useAuth();
  const histQ = useQuery({
    queryKey: ["historial", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, description, reference_photo_url, services(name, price_gs), barbers(profiles:profiles!barbers_user_id_profiles_fkey(name))",
        )
        .eq("client_id", user!.id)
        .eq("status", "completado")
        .order("scheduled_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });
  const data = histQ.data;

  return (
    <AppShell title="Mi historial" isFetching={histQ.isFetching}>
      {data && data.length > 0 ? (
        <div className="grid gap-3">
          {data.map((a) => (
            <Card key={a.id} className="p-4">
              <p className="font-semibold">{(a as any).services?.name}</p>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">{formatDateTimeAR(a.scheduled_at)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">con {(a as any).barbers?.profiles?.name ?? "Barbero"}</p>
              {a.description && <p className="text-xs italic text-muted-foreground mt-2">"{a.description}"</p>}
              <p className="text-sm font-medium text-leaf mt-2">{formatGs((a as any).services?.price_gs ?? 0)}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="Sin historial todavía"
          subtitle="Tus cortes completados aparecerán acá"
        />
      )}
    </AppShell>
  );
}
