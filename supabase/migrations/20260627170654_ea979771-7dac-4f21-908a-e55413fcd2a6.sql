DELETE FROM public.notifications WHERE user_id NOT IN (SELECT id FROM public.profiles);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;