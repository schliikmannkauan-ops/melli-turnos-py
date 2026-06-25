import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGs } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, MapPin, Scissors, User as UserIcon, Calendar as CalIcon, Loader2, Upload, Check } from "lucide-react";

export const Route = createFileRoute("/_app/agendar")({
  ssr: false,
  component: AgendarPage,
});

type Step = 1 | 2 | 3 | 4 | 5;

function AgendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null); // "any" or uuid
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => (await supabase.from("locations").select("*").order("name")).data ?? [],
  });
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () =>
      (await supabase.from("services").select("*").eq("is_active", true).order("price_gs")).data ?? [],
  });
  const { data: barbers } = useQuery({
    queryKey: ["barbers", locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const { data } = await supabase
        .from("barbers")
        .select("id, user_id, photo_url, bio, profiles:profiles!barbers_user_id_profiles_fkey(name)")
        .eq("location_id", locationId)
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: !!locationId,
  });

  const service = services?.find((s) => s.id === serviceId);
  const location = locations?.find((l) => l.id === locationId);
  const barber = barbers?.find((b) => b.id === barberId);

  // Available slots
  const candidateBarbers = useMemo(() => {
    if (!barbers) return [];
    if (!barberId || barberId === "any") return barbers;
    return barbers.filter((b) => b.id === barberId);
  }, [barbers, barberId]);

  const { data: slotInfo } = useQuery({
    queryKey: ["slots", date, candidateBarbers.map((b) => b.id).join(","), service?.duration_minutes],
    queryFn: async () => {
      if (!service || candidateBarbers.length === 0) return [];
      const barberIds = candidateBarbers.map((b) => b.id);
      const { data: blocks } = await supabase
        .from("availability_blocks")
        .select("*")
        .in("barber_id", barberIds)
        .eq("date", date);
      const dayStart = new Date(date + "T00:00:00");
      const dayEnd = new Date(date + "T23:59:59");
      const { data: appts } = await supabase
        .from("appointments")
        .select("barber_id, scheduled_at, duration_minutes, status")
        .in("barber_id", barberIds)
        .in("status", ["pendiente", "confirmado"])
        .gte("scheduled_at", dayStart.toISOString())
        .lte("scheduled_at", dayEnd.toISOString());

      const dur = service.duration_minutes;
      const slots: { time: string; barberId: string }[] = [];
      for (const block of blocks ?? []) {
        const [sh, sm] = block.start_time.split(":").map(Number);
        const [eh, em] = block.end_time.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const bs = block.break_start ? (() => { const [a, b] = block.break_start!.split(":").map(Number); return a * 60 + b; })() : null;
        const be = block.break_end ? (() => { const [a, b] = block.break_end!.split(":").map(Number); return a * 60 + b; })() : null;

        const used = (appts ?? [])
          .filter((a) => a.barber_id === block.barber_id)
          .map((a) => {
            const s = new Date(a.scheduled_at);
            const m = s.getHours() * 60 + s.getMinutes();
            return { start: m, end: m + a.duration_minutes };
          });

        for (let m = startMin; m + dur <= endMin; m += dur) {
          if (bs !== null && be !== null && !(m + dur <= bs || m >= be)) continue;
          const conflict = used.some((u) => !(m + dur <= u.start || m >= u.end));
          if (conflict) continue;
          // also exclude past times today
          const slotDate = new Date(date);
          slotDate.setHours(Math.floor(m / 60), m % 60, 0, 0);
          if (slotDate.getTime() <= Date.now()) continue;
          const hh = String(Math.floor(m / 60)).padStart(2, "0");
          const mm = String(m % 60).padStart(2, "0");
          slots.push({ time: `${hh}:${mm}`, barberId: block.barber_id });
        }
      }
      // dedupe times when multiple barbers available
      const unique = new Map<string, string>();
      for (const s of slots) if (!unique.has(s.time)) unique.set(s.time, s.barberId);
      return Array.from(unique.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, barberId]) => ({ time, barberId }));
    },
    enabled: !!service && candidateBarbers.length > 0 && step === 4,
  });

  const minDate = new Date().toISOString().slice(0, 10);

  async function handleSubmit() {
    if (!user || !service || !locationId || !time) return;
    setSubmitting(true);
    try {
      const slot = slotInfo?.find((s) => s.time === time);
      const assignedBarberId = barberId && barberId !== "any" ? barberId : slot?.barberId;
      if (!assignedBarberId) throw new Error("No hay barbero disponible");

      const [hh, mm] = time.split(":").map(Number);
      const scheduled = new Date(date);
      scheduled.setHours(hh, mm, 0, 0);

      let photoUrl: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("reference-photos")
          .upload(path, photoFile, { upsert: false });
        if (upErr) throw upErr;
        photoUrl = path; // store storage path; render via signed URL later
      }

      const { error } = await supabase.from("appointments").insert({
        client_id: user.id,
        barber_id: assignedBarberId,
        service_id: service.id,
        location_id: locationId,
        scheduled_at: scheduled.toISOString(),
        duration_minutes: service.duration_minutes,
        description: description || null,
        reference_photo_url: photoUrl,
      });
      if (error) throw error;
      toast.success("¡Solicitud enviada! Esperá la confirmación.");
      navigate({ to: "/turnos" });
    } catch (err: any) {
      toast.error(err.message || "No se pudo agendar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title={`Paso ${step} de 5`}>
      <div className="flex items-center gap-1 mb-5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-brand" : "bg-muted"}`}
          />
        ))}
      </div>

      {step > 1 && (
        <button
          onClick={() => setStep((s) => (s - 1) as Step)}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-3"
        >
          <ChevronLeft className="size-4" /> Atrás
        </button>
      )}

      {step === 1 && (
        <div>
          <h2 className="font-display text-xl mb-1">Elegí la sucursal</h2>
          <p className="text-sm text-muted-foreground mb-4">¿Dónde te vas a cortar?</p>
          <div className="grid gap-3">
            {locations?.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setLocationId(l.id);
                  setBarberId(null);
                  setStep(2);
                }}
                className="brand-card p-5 text-left flex items-center gap-4 hover:border-brand transition"
              >
                <div className="size-12 rounded-full bg-brand/20 flex items-center justify-center">
                  <MapPin className="size-6 text-leaf" />
                </div>
                <div>
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.address}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="font-display text-xl mb-1">Elegí el servicio</h2>
          <p className="text-sm text-muted-foreground mb-4">{location?.name}</p>
          <div className="grid gap-2">
            {services?.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setStep(3);
                }}
                className={`brand-card p-4 text-left flex items-center gap-3 hover:border-brand transition ${serviceId === s.id ? "border-brand" : ""}`}
              >
                <div className="size-10 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
                  <Scissors className="size-5 text-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.duration_minutes} min</p>
                </div>
                <p className="font-semibold text-leaf">{formatGs(s.price_gs)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="font-display text-xl mb-1">Elegí el barbero</h2>
          <p className="text-sm text-muted-foreground mb-4">{service?.name} · {location?.name}</p>
          <div className="grid gap-2">
            <button
              onClick={() => {
                setBarberId("any");
                setStep(4);
              }}
              className="brand-card p-4 text-left flex items-center gap-3 hover:border-brand transition"
            >
              <div className="size-12 rounded-full bg-brand/15 flex items-center justify-center">
                <UserIcon className="size-6 text-ink" />
              </div>
              <div>
                <p className="font-semibold">Cualquier barbero disponible</p>
                <p className="text-xs text-muted-foreground">Te asignamos el primero libre</p>
              </div>
            </button>
            {barbers?.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setBarberId(b.id);
                  setStep(4);
                }}
                className="brand-card p-4 text-left flex items-center gap-3 hover:border-brand transition"
              >
                <div className="size-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {b.photo_url ? <img src={b.photo_url} alt="" className="object-cover w-full h-full" /> : <UserIcon className="size-6 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold">{(b as any).profiles?.name ?? "Barbero"}</p>
                  <p className="text-xs text-muted-foreground">{location?.name}</p>
                </div>
              </button>
            ))}
            {barbers?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No hay barberos activos en esta sucursal.</p>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2 className="font-display text-xl mb-1">Fecha y hora</h2>
          <p className="text-sm text-muted-foreground mb-4">{service?.name} · {service?.duration_minutes} min</p>
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => {
              setDate(e.target.value);
              setTime(null);
            }}
            className="mb-4"
          />
          <p className="text-sm font-semibold mb-2">Horarios disponibles</p>
          {!slotInfo ? (
            <Loader2 className="animate-spin mx-auto my-6 text-muted-foreground" />
          ) : slotInfo.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay horarios para ese día. Probá otra fecha o barbero.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slotInfo.map((s) => (
                <button
                  key={s.time}
                  onClick={() => setTime(s.time)}
                  className={`py-2.5 rounded-md text-sm font-semibold border transition ${
                    time === s.time
                      ? "bg-ink text-brand border-ink"
                      : "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30 hover:bg-status-confirmed/20"
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          <Button
            disabled={!time}
            onClick={() => setStep(5)}
            className="w-full h-12 mt-6 bg-brand text-ink hover:bg-brand/90 font-semibold"
          >
            Continuar
          </Button>
        </div>
      )}

      {step === 5 && service && (
        <div>
          <h2 className="font-display text-xl mb-1">Detalles</h2>
          <p className="text-sm text-muted-foreground mb-4">Contanos más si querés</p>

          <Label htmlFor="desc">Describí tu corte ideal (opcional)</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. degradado bajo, parejo arriba..."
            maxLength={500}
            className="mb-4"
          />

          <Label className="block mb-1">Foto de referencia (opcional)</Label>
          <label className="brand-card p-4 flex items-center gap-3 cursor-pointer">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {photoFile ? photoFile.name : "Subir foto desde galería"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <Card className="p-4 mt-6 bg-surface-muted">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">Resumen</p>
            <SummaryRow icon={<MapPin className="size-4" />} label="Sucursal" value={location?.name ?? ""} />
            <SummaryRow icon={<Scissors className="size-4" />} label="Servicio" value={service.name} />
            <SummaryRow icon={<UserIcon className="size-4" />} label="Barbero" value={barberId === "any" ? "Cualquiera disponible" : barber ? (barber as any).profiles?.name : ""} />
            <SummaryRow icon={<CalIcon className="size-4" />} label="Fecha" value={`${new Date(date).toLocaleDateString("es-PY", { weekday: "long", day: "2-digit", month: "long" })} · ${time}`} />
            <div className="flex justify-between mt-3 pt-3 border-t">
              <span className="font-semibold">Total</span>
              <span className="font-display text-lg text-leaf">{formatGs(service.price_gs)}</span>
            </div>
          </Card>

          <Button
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full h-12 mt-5 bg-brand text-ink hover:bg-brand/90 font-semibold"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <><Check className="size-5" /> Solicitar turno</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">Pagás en el local al terminar</p>
        </div>
      )}
    </AppShell>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-20">{label}</span>
      <span className="font-medium flex-1 text-right truncate">{value}</span>
    </div>
  );
}
