import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/perfil")({
  ssr: false,
  component: Perfil,
});

const MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

function Perfil() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > MAX_BYTES) {
      toast.error("La foto debe pesar menos de 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signErr) throw signErr;

      const url = `${signed.signedUrl}&v=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (updErr) throw updErr;

      await qc.invalidateQueries({ queryKey: ["profile-edit", user.id] });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("✅ Foto actualizada");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }

  const avatarUrl = profile?.avatar_url as string | undefined;

  return (
    <AppShell title="Mi perfil">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <div className="size-16 rounded-full bg-brand flex items-center justify-center text-ink font-display text-2xl overflow-hidden">
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-ink" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="size-full object-cover" />
              ) : (
                (name?.[0] || "U").toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Cambiar foto de perfil"
              className="absolute -bottom-1 -right-1 size-7 rounded-full bg-black text-white flex items-center justify-center shadow-md ring-2 ring-background disabled:opacity-60"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickPhoto}
            />
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
