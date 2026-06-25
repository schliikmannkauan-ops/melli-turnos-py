import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { formatTime, formatGs } from "@/lib/format";
import { Inbox, Scissors, Users, Building2, CalendarCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  ssr: false,
  component: DashboardRouter,
});

function DashboardRouter() {
  const { role } = useAuth();
  if (role === "dueno") return <OwnerDash />;
  return <BarberDash />;
}

/* ---------------- BARBER ---------------- */

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
        .select("id, scheduled_at, services(name), profiles:profiles!appointments_client_id_profiles_fkey(name)")
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

/* ---------------- OWNER ---------------- */

function OwnerDash() {
  const today = new Date();
  const start = new Date(today); start.setHours(0,0,0,0);
  const end = new Date(today); end.setHours(23,59,59,999);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const { data: counts } = useQuery({
    queryKey: ["owner-counts", start.toISOString()],
    queryFn: async () => {
      const [locs, barbs, todayAppts, pending, monthRevenue] = await Promise.all([
        supabase.from("locations").select("*", { count: "exact", head: true }),
        supabase.from("barbers").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("appointments").select("*", { count: "exact", head: true })
          .gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString())
          .in("status", ["confirmado", "completado"]),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "pendiente"),
        supabase.from("appointments").select("services(price_gs)")
          .eq("status", "completado")
          .gte("scheduled_at", monthStart.toISOString()),
      ]);
      const revenue = (monthRevenue.data ?? []).reduce(
        (sum, r: any) => sum + (r.services?.price_gs ?? 0), 0,
      );
      return {
        locations: locs.count ?? 0,
        barbers: barbs.count ?? 0,
        today: todayAppts.count ?? 0,
        pending: pending.count ?? 0,
        revenue,
      };
    },
  });

  const { data: locBreakdown } = useQuery({
    queryKey: ["owner-loc-breakdown", start.toISOString()],
    queryFn: async () => {
      const { data: locs } = await supabase.from("locations").select("id, name").order("name");
      if (!locs) return [];
      const out = await Promise.all(
        locs.map(async (l) => {
          const { count } = await supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("location_id", l.id)
            .gte("scheduled_at", start.toISOString())
            .lte("scheduled_at", end.toISOString())
            .in("status", ["confirmado", "completado"]);
          return { id: l.id, name: l.name, today: count ?? 0 };
        }),
      );
      return out;
    },
  });

  return (
    <AppShell title="Panel del Dueño">
      <div className="mb-4">
        <h2 className="font-display text-2xl">Resumen general</h2>
        <p className="text-sm text-muted-foreground">Ambas sucursales en un vistazo</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={CalendarCheck} label="Turnos hoy" value={counts?.today ?? 0} />
        <Stat icon={Clock} label="Pendientes" value={counts?.pending ?? 0} />
        <Stat icon={Users} label="Barberos activos" value={counts?.barbers ?? 0} />
        <Stat icon={Building2} label="Sucursales" value={counts?.locations ?? 0} />
      </div>

      <Card className="p-4 mt-4 bg-brand border-brand">
        <p className="text-xs font-semibold text-ink/70 uppercase tracking-wide">Ingresos del mes</p>
        <p className="font-display text-3xl text-ink mt-1">{formatGs(counts?.revenue ?? 0)}</p>
        <p className="text-xs text-ink/70 mt-1">Turnos completados desde el 1°</p>
      </Card>

      <section className="mt-6">
        <h3 className="font-display text-lg mb-2">Hoy por sucursal</h3>
        <div className="grid gap-2">
          {(locBreakdown ?? []).map((l) => (
            <Card key={l.id} className="p-4 flex items-center gap-3">
              <Building2 className="size-5 text-leaf" />
              <p className="flex-1 font-medium">{l.name}</p>
              <span className="font-display text-2xl">{l.today}</span>
            </Card>
          ))}
          {locBreakdown && locBreakdown.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">Aún no hay sucursales cargadas.</Card>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-2">
        <Link to="/barberos"><Card className="p-4 flex items-center gap-3 hover:border-brand transition">
          <Users className="size-5 text-ink" />
          <p className="flex-1 font-medium">Gestionar barberos</p>
          <span className="text-xs text-muted-foreground">→</span>
        </Card></Link>
        <Link to="/estadisticas"><Card className="p-4 flex items-center gap-3 hover:border-brand transition">
          <span className="text-ink"><svg /></span>
          <p className="flex-1 font-medium">Ver estadísticas</p>
          <span className="text-xs text-muted-foreground">→</span>
        </Card></Link>
      </section>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4">
      <Icon className="size-5 text-leaf mb-2" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
    </Card>
  );
}
