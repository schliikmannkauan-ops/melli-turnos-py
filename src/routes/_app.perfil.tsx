import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_app/perfil")({
  ssr: false,
  component: Perfil,
});

function Perfil() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile-edit", user?.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  async function save() {
    const { error } = await supabase.from("profiles").update({ name, phone }).eq("id", user!.id);
    if (error) toast.error(error.message);
    else toast.success("Datos actualizados");
  }

  async function logout() {
    await signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <AppShell title="Mi perfil">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="size-16 rounded-full bg-brand flex items-center justify-center text-ink font-display text-2xl">
            {(name?.[0] || "U").toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{name || "Sin nombre"}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="n">Nombre</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p">Teléfono</Label>
            <Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={save} className="bg-brand text-ink hover:bg-brand/90 font-semibold">
            Guardar cambios
          </Button>
        </div>
      </Card>

      <Button
        variant="outline"
        onClick={logout}
        className="w-full mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </AppShell>
  );
}
