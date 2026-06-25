import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTimeAR, formatGs, canCancel } from "@/lib/format";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/turnos")({
  ssr: false,
  component: MisTurnos,
});

function MisTurnos() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: appts } = useQuery({
    queryKey: ["mis-turnos", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, status, duration_minutes, description, reference_photo_url, services(name, price_gs), locations(name), barbers(profiles:profiles!barbers_user_id_fkey(name))",
        )
        .eq("client_id", user!.id)
        .order("scheduled_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("client-appts")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `client_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["mis-turnos"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  async function cancel(id: string, when: string) {
    if (!canCancel(when)) {
      toast.error("No es posible cancelar con menos de 5 minutos de anticipación");
      return;
    }
    const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Turno cancelado");
      qc.invalidateQueries({ queryKey: ["mis-turnos"] });
    }
  }

  return (
    <AppShell title="Mis turnos">
      {appts && appts.length > 0 ? (
        <div className="grid gap-3">
          {appts.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold">{(a as any).services?.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{formatDateTimeAR(a.scheduled_at)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(a as any).locations?.name} · {(a as any).barbers?.profiles?.name ?? "Barbero"}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm font-medium text-leaf">{formatGs((a as any).services?.price_gs ?? 0)}</span>
                {(a.status === "pendiente" || a.status === "confirmado") && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                        Cancelar turno
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>¿Cancelar este turno?</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Vas a cancelar tu turno del {formatDateTimeAR(a.scheduled_at)}.
                      </p>
                      <Button
                        onClick={() => cancel(a.id, a.scheduled_at)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sí, cancelar
                      </Button>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {a.description && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t italic">"{a.description}"</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-muted-foreground">
          <Calendar className="size-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Aún no tenés turnos agendados.</p>
        </Card>
      )}
    </AppShell>
  );
}
