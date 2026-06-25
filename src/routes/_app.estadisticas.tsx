import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { formatGs } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_app/estadisticas")({
  ssr: false,
  component: StatsPage,
});

const COLORS = ["#F5C500", "#2D5016", "#1A1A1A", "#C49500", "#5B7F30"];

function StatsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (role && role !== "dueno") navigate({ to: "/", replace: true });
  }, [role, navigate]);

  const now = new Date();
  const start30 = new Date(now); start30.setDate(start30.getDate() - 29); start30.setHours(0,0,0,0);

  const { data: appts } = useQuery({
    queryKey: ["stats-appts", start30.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, location_id, barber_id, locations(name), barbers(profiles!barbers_user_id_profiles_fkey(name)), services(name, price_gs)")
        .gte("scheduled_at", start30.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
  });

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30); d.setDate(d.getDate() + i);
      map.set(d.toISOString().slice(0,10), 0);
    }
    (appts ?? []).forEach((a: any) => {
      if (a.status === "cancelado" || a.status === "rechazado") return;
      const k = a.scheduled_at.slice(0,10);
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({
      date: date.slice(5),
      count,
    }));
  }, [appts]);

  const byLocation = useMemo(() => {
    const map = new Map<string, number>();
    (appts ?? []).forEach((a: any) => {
      if (a.status === "cancelado" || a.status === "rechazado") return;
      const name = a.locations?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [appts]);

  const byService = useMemo(() => {
    const map = new Map<string, number>();
    (appts ?? []).forEach((a: any) => {
      if (a.status === "cancelado" || a.status === "rechazado") return;
      const name = a.services?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name, count]) => ({ name, count }));
  }, [appts]);

  const byBarber = useMemo(() => {
    const map = new Map<string, number>();
    (appts ?? []).forEach((a: any) => {
      if (a.status !== "completado") return;
      const name = a.barbers?.profiles?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + (a.services?.price_gs ?? 0));
    });
    return Array.from(map.entries()).sort((a,b) => b[1]-a[1]).map(([name, total]) => ({ name, total }));
  }, [appts]);

  const totals = useMemo(() => {
    let confirmed = 0, completed = 0, cancelled = 0, revenue = 0;
    (appts ?? []).forEach((a: any) => {
      if (a.status === "confirmado") confirmed++;
      else if (a.status === "completado") { completed++; revenue += a.services?.price_gs ?? 0; }
      else if (a.status === "cancelado" || a.status === "rechazado") cancelled++;
    });
    return { confirmed, completed, cancelled, revenue };
  }, [appts]);

  return (
    <AppShell title="Estadísticas">
      <div className="mb-4">
        <h2 className="font-display text-2xl">Últimos 30 días</h2>
        <p className="text-sm text-muted-foreground">Vista general del rendimiento</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Completados</p><p className="font-display text-2xl">{totals.completed}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Confirmados</p><p className="font-display text-2xl">{totals.confirmed}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Cancelados</p><p className="font-display text-2xl">{totals.cancelled}</p></Card>
        <Card className="p-3 bg-brand border-brand"><p className="text-xs text-ink/70">Ingresos</p><p className="font-display text-xl text-ink">{formatGs(totals.revenue)}</p></Card>
      </div>

      <Card className="p-3 mb-4">
        <h3 className="font-display text-base mb-2">Turnos por día</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <XAxis dataKey="date" fontSize={10} interval={3} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#F5C500" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3 mb-4">
        <h3 className="font-display text-base mb-2">Por sucursal</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byLocation} dataKey="value" nameKey="name" outerRadius={70} label>
                {byLocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3 mb-4">
        <h3 className="font-display text-base mb-2">Servicios más pedidos</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byService} layout="vertical">
              <XAxis type="number" fontSize={10} allowDecimals={false} />
              <YAxis type="category" dataKey="name" fontSize={10} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#2D5016" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-3">
        <h3 className="font-display text-base mb-2">Ingresos por barbero</h3>
        {byBarber.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aún no hay turnos completados.</p>
        ) : (
          <div className="grid gap-2">
            {byBarber.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                <span>{b.name}</span>
                <span className="font-semibold">{formatGs(b.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
