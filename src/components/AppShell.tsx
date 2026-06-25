import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";

export function AppShell({
  children,
  title,
  right,
  hideNav,
}: {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  hideNav?: boolean;
}) {
  const { role } = useAuth();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-brand">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <Link to="/" className="contents">
            <BrandLogo size={36} className="ring-2 ring-ink/10" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg text-ink leading-none truncate">
              {title ?? "Barbería Melli"}
            </p>
          </div>
          {right}
        </div>
      </header>
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 pb-28">{children}</main>
      {!hideNav && role && <BottomNav role={role} />}
    </div>
  );
}
