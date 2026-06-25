import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { Inbox, Scissors } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  ssr: false,
  component: BarberDash,
});

function BarberDash() {
  const { user } = useAuth();

  const { data: barber } = useQuery({
    queryKey: ["my-barber", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("barbers")
        .select("*, locations(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("name").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: pending } = useQuery({
    queryKey: ["pending-count", barber?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("barber_id", barber!.id)
        .eq("status", "pendiente");
      return count ?? 0;
    },
    enabled: !!barber,
  });

  const today = new Date();
  const start = new Date(today); start.setHours(0,0,0,0);
  const end = new Date(today); end.setHours(23,59,59,999);

  const { data: todays } = useQuery({
    queryKey: ["today-appts", barber?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, services(name), profiles:profiles!appointments_client_id_fkey(name)")
        .eq("barber_id", barber!.id)
        .eq("status", "confirmado")
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
    enabled: !!barber,
  });

  if (!barber) {
    return (
      <AppShell title="Inicio">
        <Card className="p-6 text-sm text-muted-foreground">
          Tu cuenta de barbero todavía no está vinculada a una sucursal. Pedile al dueño que te asigne.
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Inicio">
      <div className="mb-5">
        <h2 className="font-display text-2xl">Hola, {profile?.name || "Barbero"} ✂️</h2>
        <p className="text-sm text-muted-foreground">Sucursal {(barber as any).locations?.name}</p>
      </div>

      <Link to="/solicitudes">
        <Card className="p-4 flex items-center gap-4 bg-brand border-brand">
          <div className="size-12 rounded-full bg-ink/10 flex items-center justify-center">
            <Inbox className="size-6 text-ink" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink">Solicitudes pendientes</p>
            <p className="text-xs text-ink/70">Tocá para revisar</p>
          </div>
          <span className="bg-ink text-brand font-bold rounded-full size-9 flex items-center justify-center text-sm">
            {pending ?? 0}
          </span>
        </Card>
      </Link>

      <section className="mt-6">
        <h3 className="font-display text-lg mb-2">Hoy</h3>
        {todays && todays.length > 0 ? (
          <div className="grid gap-2">
            {todays.map((a) => (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                <div className="bg-leaf/10 text-leaf rounded-md px-2.5 py-1.5 text-sm font-semibold">
                  {formatTime(a.scheduled_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{(a as any).profiles?.name ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Scissors className="size-3" /> {(a as any).services?.name}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Sin turnos confirmados para hoy.
          </Card>
        )}
      </section>
    </AppShell>
  );
}
