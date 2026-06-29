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
    if (!input?.email || !input.password || !input.name || !input.location_id)
      throw new Error("Faltan datos obligatorios");
    if (input.password.length < 8)
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    if (!/\d/.test(input.password))
      throw new Error("La contraseña debe incluir al menos un número");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "dueno",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Solo el dueño puede crear barberos");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error("Error al verificar usuarios: " + listErr.message);

    let userId: string;
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());

    if (existing) {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        user_metadata: { name: data.name, phone: data.phone, role: "barbero" },
        email_confirm: true,
      });
      if (updateErr) throw new Error("Error actualizando usuario: " + updateErr.message);
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name, phone: data.phone, role: "barbero" },
      });
      if (createErr) throw new Error("Error creando usuario: " + createErr.message);
      if (!created?.user) throw new Error("No se pudo crear el usuario en el sistema de autenticación");
      userId = created.user.id;
    }

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      { id: userId, name: data.name, email: data.email.toLowerCase(), phone: data.phone },
      { onConflict: "id" }
    );
    if (profileErr) throw new Error("Error actualizando perfil: " + profileErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleInsertErr } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "barbero" });
    if (roleInsertErr) throw new Error("Error asignando rol: " + roleInsertErr.message);

    const { error: barberErr } = await supabaseAdmin.from("barbers").upsert(
      { user_id: userId, location_id: data.location_id, bio: data.bio ?? null, is_active: true },
      { onConflict: "user_id" }
    );
    if (barberErr) throw new Error("Error creando registro de barbero: " + barberErr.message);

    return { ok: true, user_id: userId };
  });

export const deleteBarberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input?.user_id) throw new Error("user_id requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "dueno",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Solo el dueño puede eliminar barberos");

    if (data.user_id === context.userId) throw new Error("No podés eliminar tu propia cuenta");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error("Error eliminando usuario: " + error.message);

    return { ok: true };
  });
