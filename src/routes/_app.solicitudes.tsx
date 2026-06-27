import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTimeAR } from "@/lib/format";
import { toast } from "sonner";
import { ImageIcon, Check, X, CheckCircle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/solicitudes")({
  ssr: false,
  component: Solicitudes,
});

function Solicitudes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const { data: barber } = useQuery({
    queryKey: ["my-barber-id", user?.id],
    queryFn: async () =>
      (await supabase.from("barbers").select("id").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const requestsQ = useQuery({
    queryKey: ["requests", barber?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, description, reference_photo_url, services(name), profiles:profiles!appointments_client_id_profiles_fkey(name, avatar_url, phone)",
        )
        .eq("barber_id", barber!.id)
        .eq("status", "pendiente")
        .order("scheduled_at");
      return data ?? [];
    },
    enabled: !!barber,
  });
  const requests = requestsQ.data;

  useEffect(() => {
    if (!barber) return;
    const ch = supabase
      .channel("barber-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `barber_id=eq.${barber.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["requests"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [barber, qc]);

  // Generate signed URLs for reference photos
  useEffect(() => {
    if (!requests) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const r of requests) {
        if (r.reference_photo_url) {
          const { data } = await supabase.storage
            .from("reference-photos")
            .createSignedUrl(r.reference_photo_url, 3600);
          if (data?.signedUrl) next[r.id] = data.signedUrl;
        }
      }
      setPhotoUrls(next);
    })();
  }, [requests]);

  async function decide(id: string, status: "confirmado" | "rechazado") {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "confirmado" ? "✅ Turno confirmado" : "❌ Turno rechazado");
      qc.invalidateQueries({ queryKey: ["requests"] });
    }
  }

  return (
    <AppShell title="Solicitudes" isFetching={requestsQ.isFetching}>
      {requests && requests.length > 0 ? (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="size-12 rounded-full bg-brand/20 flex items-center justify-center font-display text-ink shrink-0">
                  {((r as any).profiles?.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{(r as any).profiles?.name ?? "Cliente"}</p>
                  <p className="text-sm text-muted-foreground">{(r as any).services?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{formatDateTimeAR(r.scheduled_at)}</p>
                </div>
              </div>
              {r.description && (
                <p className="text-xs italic text-muted-foreground bg-surface-muted p-2 rounded-md mb-3">"{r.description}"</p>
              )}
              {r.reference_photo_url && (
                <div className="mb-3">
                  {photoUrls[r.id] ? (
                    <img src={photoUrls[r.id]} alt="Referencia" className="rounded-md max-h-40 object-cover" />
                  ) : (
                    <div className="bg-muted h-20 rounded-md flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => decide(r.id, "confirmado")} className="flex-1 bg-status-confirmed text-white hover:bg-status-confirmed/90">
                  <Check className="size-4" /> Confirmar
                </Button>
                <Button onClick={() => decide(r.id, "rechazado")} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  <X className="size-4" /> Rechazar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckCircle}
          title="Todo al día"
          subtitle="No hay solicitudes pendientes"
        />
      )}
    </AppShell>
  );
}
