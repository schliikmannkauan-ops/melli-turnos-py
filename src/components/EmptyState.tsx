import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-8 text-center animate-fade-in">
      <div className="mx-auto mb-3 size-14 rounded-full bg-brand/15 flex items-center justify-center">
        <Icon className="size-7 text-brand" />
      </div>
      <p className="font-display text-base text-foreground">{title}</p>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
    </Card>
  );
}
