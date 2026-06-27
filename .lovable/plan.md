## Fix 1 — Strong password for new barbers

File: `src/routes/_app.barberos.tsx`

- Change `useState` initial `password: "demo1234"` to `password: ""`.
- In `submit()`, before calling `createFn`, validate:
  - length ≥ 8
  - contains at least one digit (`/\d/`)
- If invalid → `toast.error("La contraseña debe tener al menos 8 caracteres y un número")` and return without submitting.
- Keep existing `minLength={6}` updated to `minLength={8}` on the `Input` for consistency.

## Fix 2 — FK on notifications.user_id → profiles.id

New Supabase migration:

```sql
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;
```

(First delete any orphan `notifications` rows whose `user_id` has no matching profile to avoid constraint failure.)

## After applying

Call `security--manage_security_finding` with `mark_as_fixed` for both findings, then briefly confirm to the user.
