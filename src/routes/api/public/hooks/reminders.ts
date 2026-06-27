import { createFileRoute } from "@tanstack/react-router";

/**
 * Recordatorios automáticos de turnos (1 hora antes).
 *
 * Este endpoint es público (vive bajo /api/public/hooks/) y no requiere autenticación,
 * por lo que puede ser invocado por un servicio de cron externo.
 *
 * Configurá un cron job (por ejemplo en https://cron-job.org) que haga una petición
 * POST cada 15 minutos a:
 *
 *   https://melli-turnos-py.lovable.app/api/public/hooks/reminders
 *
 * En cada ejecución:
 *   1. Busca turnos con status = 'confirmado' y reminder_sent = false cuyo
 *      scheduled_at esté entre NOW() y NOW() + 1 hora.
 *   2. Inserta una notificación para el cliente y otra para el barbero.
 *   3. Marca el turno como reminder_sent = true para no repetir el aviso.
 */
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const now = new Date();
        const lo = now.toISOString();
        const hi = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("appointments")
          .select(
            "id, client_id, scheduled_at, services(name), profiles:profiles!appointments_client_id_profiles_fkey(name), barbers(user_id)",
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
          const svc = (a as any).services?.name ?? "tu servicio";
          const clientName = (a as any).profiles?.name ?? "un cliente";
          const barberUserId = (a as any).barbers?.user_id;

          // Notificación para el cliente
          notifs.push({
            user_id: a.client_id,
            title: "⏰ Recordatorio de turno",
            body: `Tu turno de ${svc} es en 1 hora. ¡No llegues tarde!`,
            type: "recordatorio",
          });

          // Notificación para el barbero
          if (barberUserId) {
            notifs.push({
              user_id: barberUserId,
              title: "⏰ Turno en 1 hora",
              body: `Tenés un turno de ${svc} con ${clientName} en 1 hora.`,
              type: "recordatorio",
            });
          }

          ids.push(a.id);
        }

        if (notifs.length > 0) {
          await supabaseAdmin.from("notifications").insert(notifs);
          await supabaseAdmin.from("appointments").update({ reminder_sent: true }).in("id", ids);
        }

        return new Response(
          JSON.stringify({ processed: ids.length, notifications: notifs.length }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
