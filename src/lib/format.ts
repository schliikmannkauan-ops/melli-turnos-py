export function formatGs(amount: number): string {
  return `${amount.toLocaleString("es-PY")} GS`;
}

export function formatDateTimeAR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-PY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PY", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function canCancel(scheduledAt: string): boolean {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  return diff > 5 * 60 * 1000;
}
