import { createServerFn } from "@tanstack/react-start";

export const seedDemoUsers = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const demos = [
    { email: "cliente@demo.com", password: "demo1234", name: "Cliente Demo", role: "cliente" as const, phone: "0981000001" },
    { email: "barbero@demo.com", password: "demo1234", name: "Carlos Barbero", role: "barbero" as const, phone: "0981000002" },
    { email: "dueno@demo.com", password: "demo1234", name: "Dueño Melli", role: "dueno" as const, phone: "0981000003" },
  ];

  const { data: existingPage } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const existing = existingPage?.users ?? [];

  for (const d of demos) {
    let user = existing.find((u) => u.email === d.email);
    if (!user) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: d.email,
        password: d.password,
        email_confirm: true,
        user_metadata: { name: d.name, phone: d.phone, role: d.role },
      });
      if (error) throw new Error(`Create ${d.email}: ${error.message}`);
      user = data.user!;
    }
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: user.id, name: d.name, email: d.email, phone: d.phone });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: d.role }, { onConflict: "user_id,role" });
  }

  // Ensure barbero@demo.com has a barber record at Nueva Esperanza
  const { data: pageAfter } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const barberUser = pageAfter?.users.find((u) => u.email === "barbero@demo.com");
  if (barberUser) {
    const { data: loc } = await supabaseAdmin
      .from("locations")
      .select("id")
      .eq("name", "Nueva Esperanza")
      .maybeSingle();
    if (loc) {
      await supabaseAdmin
        .from("barbers")
        .upsert(
          { user_id: barberUser.id, location_id: loc.id, is_active: true, bio: "Barbero principal" },
          { onConflict: "user_id" },
        );
    }
  }

  return { ok: true };
});
