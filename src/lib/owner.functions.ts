import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateBarberInput = {
  email: string;
  password: string;
  name: string;
  phone: string;
  location_id: string;
  bio?: string;
};

export const createBarberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateBarberInput) => {
    if (!input?.email || !input.password || !input.name || !input.location_id) {
      throw new Error("Faltan datos obligatorios");
    }
    if (input.password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Authorize: must be dueno
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "dueno",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Solo el dueño puede crear barberos");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create auth user
    const { data: existingPage } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    let user = existingPage?.users.find((u) => u.email === data.email);
    if (!user) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name, phone: data.phone, role: "barbero" },
      });
      if (error) throw new Error(error.message);
      user = created.user!;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: user.id, name: data.name, email: data.email, phone: data.phone });

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "barbero" }, { onConflict: "user_id,role" });

    const { error: bErr } = await supabaseAdmin
      .from("barbers")
      .upsert(
        {
          user_id: user.id,
          location_id: data.location_id,
          bio: data.bio ?? null,
          is_active: true,
        },
        { onConflict: "user_id" },
      );
    if (bErr) throw new Error(bErr.message);

    return { ok: true, user_id: user.id };
  });
