
-- 1. profiles_barber_view_clients: restrict to barber's own clients
DROP POLICY IF EXISTS profiles_barber_view_clients ON public.profiles;
CREATE POLICY profiles_barber_view_clients ON public.profiles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'barbero'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.barbers b ON b.id = a.barber_id
      WHERE a.client_id = profiles.id AND b.user_id = auth.uid()
    )
  );

-- 2. user_roles: restrict writes to dueno only
CREATE POLICY user_roles_owner_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'dueno'::app_role));
CREATE POLICY user_roles_owner_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'dueno'::app_role))
  WITH CHECK (has_role(auth.uid(), 'dueno'::app_role));
CREATE POLICY user_roles_owner_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'dueno'::app_role));

-- 3. ref_photos_barber_read: restrict to barber's own clients (path: <client_id>/...)
DROP POLICY IF EXISTS ref_photos_barber_read ON storage.objects;
CREATE POLICY ref_photos_barber_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reference-photos'
    AND has_role(auth.uid(), 'barbero'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.barbers b ON b.id = a.barber_id
      WHERE b.user_id = auth.uid()
        AND a.client_id::text = (storage.foldername(name))[1]
    )
  );

-- 4. appointments client update: restrict mutable columns via trigger + WITH CHECK
DROP POLICY IF EXISTS appts_client_update ON public.appointments;
CREATE POLICY appts_client_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_client_appointment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the updater is the client and not the owner/barber
  IF auth.uid() = OLD.client_id
     AND NOT public.has_role(auth.uid(), 'dueno'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.barbers b
       WHERE b.id = OLD.barber_id AND b.user_id = auth.uid()
     )
  THEN
    IF NEW.barber_id      IS DISTINCT FROM OLD.barber_id
       OR NEW.service_id  IS DISTINCT FROM OLD.service_id
       OR NEW.location_id IS DISTINCT FROM OLD.location_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.client_id   IS DISTINCT FROM OLD.client_id
       OR NEW.reminder_sent IS DISTINCT FROM OLD.reminder_sent
    THEN
      RAISE EXCEPTION 'Clients cannot modify booking assignment fields';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'cancelado'::appointment_status
    THEN
      RAISE EXCEPTION 'Clients can only cancel their appointments';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS appts_enforce_client_update ON public.appointments;
CREATE TRIGGER appts_enforce_client_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_appointment_update();

-- 5. Revoke EXECUTE on SECURITY DEFINER helpers not meant to be called directly
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_appointment_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_client_appointment_update() FROM PUBLIC, anon, authenticated;
