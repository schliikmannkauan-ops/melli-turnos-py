import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint: inserts reminder notifications for appointments ~1h away.
// Called by pg_cron every 5 minutes.
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = Date.now();
        const lo = new Date(now + 55 * 60 * 1000).toISOString();
        const hi = new Date(now + 65 * 60 * 1000).toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("appointments")
          .select(
            "id, client_id, scheduled_at, services(name), barbers(user_id, profiles:profiles!barbers_user_id_profiles_fkey(name))",
          )
          .eq("status", "confirmado")
          .eq("reminder_sent", false)
          .gte("scheduled_at", lo)
          .lte("scheduled_at", hi);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const notifs: { user_id: string; title: string; body: string; type: string }[] = [];
        const ids: string[] = [];

        for (const a of due ?? []) {
          const when = new Date(a.scheduled_at).toLocaleTimeString("es-PY", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const svc = (a as any).services?.name ?? "tu turno";
          const barberName = (a as any).barbers?.profiles?.name ?? "tu barbero";
          const barberUserId = (a as any).barbers?.user_id;

          notifs.push({
            user_id: a.client_id,
            title: "Tu turno es en 1 hora ⏰",
            body: `${svc} a las ${when} con ${barberName}`,
            type: "recordatorio",
          });
          if (barberUserId) {
            notifs.push({
              user_id: barberUserId,
              title: "Turno en 1 hora",
              body: `${svc} a las ${when}`,
              type: "recordatorio",
            });
          }
          ids.push(a.id);
        }

        if (notifs.length > 0) {
          await supabaseAdmin.from("notifications").insert(notifs);
          await supabaseAdmin.from("appointments").update({ reminder_sent: true }).in("id", ids);
        }

        return new Response(JSON.stringify({ processed: ids.length }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
