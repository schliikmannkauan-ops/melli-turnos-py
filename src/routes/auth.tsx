import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
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
  const { session, role, refresh } = useAuth();
  const [isRegister, setIsRegister] = useState(mode === "register");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (session && role) {
      navigate({
        to: role === "cliente" ? "/inicio" : "/dashboard",
        replace: true,
      });
    }
  }, [session, role, navigate]);

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

      </div>
    </div>
  );
}
