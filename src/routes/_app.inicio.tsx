import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTimeAR } from "@/lib/format";
import { Plus, Scissors, CalendarX } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/inicio")({
  ssr: false,
  component: HomeCliente,
});

function HomeCliente() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("name").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: upcoming } = useQuery({
    queryKey: ["upcoming", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, services(name), locations(name), barbers(profiles:profiles!barbers_user_id_profiles_fkey(name))")
        .eq("client_id", user!.id)
        .in("status", ["confirmado", "pendiente"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: recent } = useQuery({
    queryKey: ["recent", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, services(name)")
        .eq("client_id", user!.id)
        .order("scheduled_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <AppShell title="Inicio">
      <div className="mb-5">
        <h2 className="font-display text-2xl">¡Hola, {profile?.name || "amigo"}! 👋</h2>
        <p className="text-sm text-muted-foreground mt-1">¿Listo para tu próximo corte?</p>
      </div>

      <Link to="/agendar">
        <Button className="w-full h-14 bg-brand text-ink hover:bg-brand/90 text-base font-semibold shadow-md">
          <Plus className="size-5 mr-1" /> Agendar turno
        </Button>
      </Link>

      <section className="mt-7">
        <h3 className="font-display text-lg mb-2">Próximo turno</h3>
        {upcoming && upcoming.length > 0 ? (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold flex items-center gap-2">
                  <Scissors className="size-4 text-brand" />
                  {(upcoming[0] as any).services?.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1 capitalize">
                  {formatDateTimeAR(upcoming[0].scheduled_at)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(upcoming[0] as any).locations?.name} · {(upcoming[0] as any).barbers?.profiles?.name ?? "Barbero"}
                </p>
              </div>
              <StatusBadge status={upcoming[0].status} />
            </div>
          </Card>
        ) : (
          <Card className="p-5 text-center text-sm text-muted-foreground">
            <Calendar className="size-7 mx-auto mb-2 opacity-50" />
            No tenés turnos próximos
          </Card>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">Recientes</h3>
          <Link to="/turnos" className="text-xs font-semibold text-leaf">Ver todos →</Link>
        </div>
        <div className="grid gap-2">
          {recent && recent.length > 0 ? (
            recent.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{(a as any).services?.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTimeAR(a.scheduled_at)}</p>
                </div>
                <StatusBadge status={a.status} />
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aún no tenés turnos.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
