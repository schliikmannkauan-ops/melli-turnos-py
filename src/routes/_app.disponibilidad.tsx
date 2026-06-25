import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/disponibilidad")({
  ssr: false,
  component: Disponibilidad,
});

function Disponibilidad() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [applyDays, setApplyDays] = useState(1);

  const { data: barber } = useQuery({
    queryKey: ["my-barber-id-3", user?.id],
    queryFn: async () => (await supabase.from("barbers").select("id").eq("user_id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: blocks } = useQuery({
    queryKey: ["blocks", barber?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("availability_blocks")
        .select("*")
        .eq("barber_id", barber!.id)
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date");
      return data ?? [];
    },
    enabled: !!barber,
  });

  async function addBlocks() {
    if (!barber) return;
    const rows = Array.from({ length: applyDays }, (_, i) => {
      const d = new Date(date);
      d.setDate(d.getDate() + i);
      return {
        barber_id: barber.id,
        date: d.toISOString().slice(0, 10),
        start_time: start,
        end_time: end,
        break_start: breakStart || null,
        break_end: breakEnd || null,
      };
    });
    const { error } = await supabase.from("availability_blocks").upsert(rows, { onConflict: "barber_id,date" });
    if (error) toast.error(error.message);
    else {
      toast.success(`${applyDays} día(s) configurados`);
      qc.invalidateQueries({ queryKey: ["blocks"] });
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("availability_blocks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["blocks"] });
  }

  return (
    <AppShell title="Disponibilidad">
      <Card className="p-4">
        <h3 className="font-display text-lg mb-3">Definir horario</h3>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="d">Desde el día</Label>
            <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Entrada</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Salida</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Descanso inicio</Label>
              <Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
            </div>
            <div>
              <Label>Descanso fin</Label>
              <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Aplicar a (días consecutivos)</Label>
            <Input type="number" min={1} max={30} value={applyDays} onChange={(e) => setApplyDays(Math.max(1, Number(e.target.value)))} />
          </div>
          <Button onClick={addBlocks} className="bg-brand text-ink hover:bg-brand/90 font-semibold">
            <Plus className="size-4" /> Guardar horario
          </Button>
        </div>
      </Card>

      <h3 className="font-display text-lg mt-6 mb-2">Próximos días configurados</h3>
      <div className="grid gap-2">
        {blocks && blocks.length > 0 ? (
          blocks.map((b) => (
            <Card key={b.id} className="p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold capitalize">
                  {new Date(b.date + "T12:00").toLocaleDateString("es-PY", { weekday: "long", day: "2-digit", month: "short" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                  {b.break_start && b.break_end ? ` · descanso ${b.break_start.slice(0,5)}-${b.break_end.slice(0,5)}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(b.id)} className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Sin horarios cargados todavía.</p>
        )}
      </div>
    </AppShell>
  );
}
