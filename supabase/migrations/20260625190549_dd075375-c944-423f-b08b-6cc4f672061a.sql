
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_profiles_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.barbers
  ADD CONSTRAINT barbers_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
