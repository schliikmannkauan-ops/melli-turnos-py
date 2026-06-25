import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Building2, Users, CalendarCheck, Clock, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/_app/sucursales")({
  ssr: false,
  component: SucursalesPage,
});

function SucursalesPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (role && role !== "dueno") navigate({ to: "/", replace: true });
  }, [role, navigate]);

  const today = new Date();
  const start = new Date(today); start.setHours(0,0,0,0);
  const end = new Date(today); end.setHours(23,59,59,999);

  const { data: locations } = useQuery({
    queryKey: ["sucursales-detail", start.toISOString()],
    queryFn: async () => {
      const { data: locs } = await supabase.from("locations").select("*").order("name");
      if (!locs) return [];
      return Promise.all(
        locs.map(async (l) => {
          const [barbs, today, pending] = await Promise.all([
            supabase.from("barbers").select("*", { count: "exact", head: true })
              .eq("location_id", l.id).eq("is_active", true),
            supabase.from("appointments").select("*", { count: "exact", head: true })
              .eq("location_id", l.id)
              .gte("scheduled_at", start.toISOString())
              .lte("scheduled_at", end.toISOString())
              .in("status", ["confirmado", "completado"]),
            supabase.from("appointments").select("*", { count: "exact", head: true })
              .eq("location_id", l.id).eq("status", "pendiente"),
          ]);
          return {
            ...l,
            barbers: barbs.count ?? 0,
            today: today.count ?? 0,
            pending: pending.count ?? 0,
          };
        }),
      );
    },
  });

  return (
    <AppShell title="Sucursales">
      <div className="mb-4">
        <h2 className="font-display text-2xl">Sucursales</h2>
        <p className="text-sm text-muted-foreground">Estado actual de cada local</p>
      </div>

      <div className="grid gap-3">
        {(locations ?? []).map((l: any) => (
          <Card key={l.id} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="size-5 text-leaf" />
              <h3 className="font-display text-lg flex-1">{l.name}</h3>
            </div>
            {l.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <MapPin className="size-3" /> {l.address}
              </p>
            )}
            {l.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                <Phone className="size-3" /> {l.phone}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <MiniStat icon={Users} label="Barberos" value={l.barbers} />
              <MiniStat icon={CalendarCheck} label="Hoy" value={l.today} />
              <MiniStat icon={Clock} label="Pendientes" value={l.pending} />
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-surface-muted rounded-md p-2 text-center">
      <Icon className="size-4 text-muted-foreground mx-auto mb-1" />
      <p className="font-display text-xl">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
