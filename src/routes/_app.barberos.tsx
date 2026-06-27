import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createBarberAccount } from "@/lib/owner.functions";
import { Loader2, Plus, Building2 } from "lucide-react";

export const Route = createFileRoute("/_app/barberos")({
  ssr: false,
  component: BarberosPage,
});

function BarberosPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createBarberAccount);

  useEffect(() => {
    if (role && role !== "dueno") navigate({ to: "/", replace: true });
  }, [role, navigate]);

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => (await supabase.from("locations").select("*").order("name")).data ?? [],
  });

  const { data: barbers, isLoading } = useQuery({
    queryKey: ["barbers-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("barbers")
        .select("*, locations(name), profiles!barbers_user_id_profiles_fkey(name, email, phone)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", location_id: "", bio: "" });
  const [saving, setSaving] = useState(false);

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from("barbers").update({ is_active: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(current ? "Barbero desactivado" : "Barbero activado");
    qc.invalidateQueries({ queryKey: ["barbers-all"] });
  }

  async function changeLocation(id: string, location_id: string) {
    const { error } = await supabase.from("barbers").update({ location_id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sucursal actualizada");
    qc.invalidateQueries({ queryKey: ["barbers-all"] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.location_id) return toast.error("Elegí una sucursal");
    if (form.password.length < 8 || !/\d/.test(form.password)) {
      return toast.error("La contraseña debe tener al menos 8 caracteres y un número");
    }
    setSaving(true);
    try {
      await createFn({ data: form });
      toast.success("Barbero creado");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", password: "demo1234", location_id: "", bio: "" });
      qc.invalidateQueries({ queryKey: ["barbers-all"] });
    } catch (err: any) {
      toast.error(err.message || "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Barberos">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl">Equipo</h2>
          <p className="text-sm text-muted-foreground">{barbers?.length ?? 0} barberos en total</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand text-ink hover:bg-brand/90 font-semibold gap-1"><Plus className="size-4" /> Nuevo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nuevo barbero</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="grid gap-3">
              <div><Label>Nombre completo</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Teléfono</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Contraseña inicial</Label><Input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Sucursal</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegí sucursal" /></SelectTrigger>
                  <SelectContent>
                    {(locations ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Bio (opcional)</Label><Input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
              <Button type="submit" disabled={saving} className="bg-ink text-brand hover:bg-ink/90 mt-1">
                {saving ? <Loader2 className="animate-spin" /> : "Crear barbero"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand" /></div>
      ) : (
        <div className="grid gap-3">
          {(barbers ?? []).map((b: any) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="size-12 rounded-full bg-brand/20 flex items-center justify-center font-display text-lg">
                  {(b.profiles?.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{b.profiles?.name ?? "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.profiles?.email}</p>
                  {b.profiles?.phone && <p className="text-xs text-muted-foreground">{b.profiles.phone}</p>}
                </div>
                <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <Select value={b.location_id} onValueChange={(v) => changeLocation(b.id, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(locations ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {b.bio && <p className="text-xs text-muted-foreground mt-2 italic">"{b.bio}"</p>}
            </Card>
          ))}
          {barbers && barbers.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Aún no cargaste barberos. Tocá "Nuevo" para empezar.
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
