import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["appointment_status"];

const labels: Record<Status, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  completado: "Completado",
};

const styles: Record<Status, string> = {
  pendiente: "bg-status-pending/20 text-ink border-status-pending",
  confirmado: "bg-status-confirmed/15 text-status-confirmed border-status-confirmed/40",
  rechazado: "bg-status-rejected/10 text-status-rejected border-status-rejected/40",
  cancelado: "bg-status-cancelled/15 text-muted-foreground border-status-cancelled/40",
  completado: "bg-status-completed/15 text-status-completed border-status-completed/40",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
