import { Link, useLocation } from "@tanstack/react-router";
import { Home, Calendar, Plus, Clock, Bell, LayoutDashboard, Inbox, CalendarDays, Settings } from "lucide-react";
import type { AppRole } from "@/hooks/use-auth";

const clientItems = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/turnos", label: "Turnos", icon: Calendar },
  { to: "/agendar", label: "Agendar", icon: Plus, primary: true },
  { to: "/historial", label: "Historial", icon: Clock },
  { to: "/notificaciones", label: "Avisos", icon: Bell },
] as const;

const barberItems = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/solicitudes", label: "Solicitudes", icon: Inbox },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/disponibilidad", label: "Horario", icon: Settings },
] as const;

export function BottomNav({ role }: { role: AppRole }) {
  const items = role === "cliente" ? clientItems : barberItems;
  const loc = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = loc.pathname === item.to;
          const isPrimary = "primary" in item && item.primary;
          if (isPrimary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-end py-1 px-3 -mt-5"
              >
                <span className="bg-brand text-ink rounded-full size-14 flex items-center justify-center shadow-lg ring-4 ring-background">
                  <Icon className="size-6" strokeWidth={2.5} />
                </span>
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 ${active ? "text-ink" : "text-muted-foreground"}`}
            >
              <Icon className={`size-5 ${active ? "stroke-2" : ""}`} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
