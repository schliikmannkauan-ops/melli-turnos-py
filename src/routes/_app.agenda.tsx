import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { ChevronLeft, ChevronRight, Scissors } from "lucide-react";

export const Route = createFileRoute("/_app/agenda")({
  ssr: false,
  component: Agenda,
});

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // monday=0
  x.setDate(x.getDate() - day);
  return x;
}

function Agenda() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const { data: barber } = useQuery({
    queryKey: ["my-barber-id-2", user?.id],
    queryFn: async () => (await supabase.from("barbers").select("id").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: appts } = useQuery({
    queryKey: ["week-appts", barber?.id, weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, duration_minutes, status, description, services(name), profiles:profiles!appointments_client_id_profiles_fkey(name)",
        )
        .eq("barber_id", barber!.id)
        .eq("status", "confirmado")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
    enabled: !!barber,
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <AppShell title="Mi agenda">
      <div className="flex items-center justify-between mb-4">
        <Button size="icon" variant="ghost" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}>
          <ChevronLeft />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {weekStart.toLocaleDateString("es-PY", { day: "2-digit", month: "short" })} —{" "}
          {new Date(weekEnd.getTime() - 1).toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}
        </span>
        <Button size="icon" variant="ghost" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}>
          <ChevronRight />
        </Button>
      </div>

      <div className="grid gap-3">
        {days.map((d) => {
          const dayKey = d.toDateString();
          const dayAppts = (appts ?? []).filter((a) => new Date(a.scheduled_at).toDateString() === dayKey);
          return (
            <div key={dayKey}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 capitalize">
                {d.toLocaleDateString("es-PY", { weekday: "long", day: "2-digit", month: "short" })}
              </p>
              {dayAppts.length > 0 ? (
                <div className="grid gap-2">
                  {dayAppts.map((a) => (
                    <Card key={a.id} className="p-3 flex items-center gap-3">
                      <div className="bg-brand text-ink rounded-md px-2.5 py-1.5 text-sm font-semibold">
                        {formatTime(a.scheduled_at)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{(a as any).profiles?.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Scissors className="size-3" /> {(a as any).services?.name} · {a.duration_minutes} min
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic pl-1">Sin turnos</p>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
