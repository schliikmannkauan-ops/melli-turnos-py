import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { seedDemoUsers } from "@/lib/seed.functions";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).default("login"),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, role, refresh, signOut } = useAuth();
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const seed = useServerFn(seedDemoUsers);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Note: no auto-redirect when already signed in. Show a panel instead so the user
  // can either continue to their dashboard or sign out to use a different account.

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, phone, role: "cliente" },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("¡Cuenta creada! Iniciando sesión...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("¡Bienvenido!");
      }
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  async function fillDemo(em: string) {
    setSeeding(true);
    try {
      await seed();
      setEmail(em);
      setPassword("demo1234");
      setIsRegister(false);
      toast.success("Cuentas demo listas. Tocá Iniciar sesión.");
    } catch (err: any) {
      toast.error(err.message || "No se pudo preparar la demo");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-brand p-6 flex flex-col items-center text-center">
        <Link to="/" className="contents">
          <BrandLogo size={88} />
        </Link>
        <h1 className="font-display text-2xl text-ink mt-3">Barbería Melli</h1>
      </div>

      <div className="flex-1 p-5 max-w-md w-full mx-auto">
        <Card className="p-5">
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${!isRegister ? "bg-ink text-brand" : "bg-muted text-muted-foreground"}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${isRegister ? "bg-ink text-brand" : "bg-muted text-muted-foreground"}`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {isRegister && (
              <>
                <div>
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 mt-2 bg-brand text-ink hover:bg-brand/90 font-semibold">
              {loading ? <Loader2 className="animate-spin" /> : isRegister ? "Crear cuenta" : "Iniciar sesión"}
            </Button>
          </form>
        </Card>

        <Card className="p-4 mt-4 bg-surface-muted">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cuentas de prueba</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Tocá una para preparar las cuentas demo (contraseña: <span className="font-mono">demo1234</span>).
          </p>
          <div className="grid gap-2">
            <DemoButton emoji="👤" label="Cliente" email="cliente@demo.com" onClick={() => fillDemo("cliente@demo.com")} loading={seeding} />
            <DemoButton emoji="✂️" label="Barbero" email="barbero@demo.com" onClick={() => fillDemo("barbero@demo.com")} loading={seeding} />
            <DemoButton emoji="👑" label="Dueño" email="dueno@demo.com" onClick={() => fillDemo("dueno@demo.com")} loading={seeding} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function DemoButton({ emoji, label, email, onClick, loading }: { emoji: string; label: string; email: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-3 p-3 rounded-md bg-surface border border-border text-left hover:border-brand transition disabled:opacity-60"
    >
      <span className="text-xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">{email}</div>
      </div>
      {loading && <Loader2 className="animate-spin size-4" />}
    </button>
  );
}
