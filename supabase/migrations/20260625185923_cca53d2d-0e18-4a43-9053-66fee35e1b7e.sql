
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('cliente', 'barbero', 'dueno');
CREATE TYPE public.appointment_status AS ENUM ('pendiente','confirmado','rechazado','cancelado','completado');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'dueno' THEN 1 WHEN 'barbero' THEN 2 ELSE 3 END LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_owner_all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'dueno'));
CREATE POLICY "profiles_barber_view_clients" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'barbero'));

-- user_roles policies (read-only to self; only service_role manages writes)
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_owner_select" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'dueno'));

-- ============ LOCATIONS ============
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.locations TO authenticated, anon;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations_read_all" ON public.locations FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "locations_owner_write" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dueno')) WITH CHECK (public.has_role(auth.uid(),'dueno'));

-- ============ SERVICES ============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_minutes INT NOT NULL,
  price_gs INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO authenticated, anon;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_read_all" ON public.services FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "services_owner_write" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dueno')) WITH CHECK (public.has_role(auth.uid(),'dueno'));

-- ============ BARBERS ============
CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id),
  bio TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.barbers TO authenticated, anon;
GRANT INSERT, UPDATE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barbers_read_all" ON public.barbers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "barbers_self_update" ON public.barbers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "barbers_owner_write" ON public.barbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dueno')) WITH CHECK (public.has_role(auth.uid(),'dueno'));

-- ============ AVAILABILITY ============
CREATE TABLE public.availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(barber_id, date)
);
GRANT SELECT ON public.availability_blocks TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.availability_blocks TO authenticated;
GRANT ALL ON public.availability_blocks TO service_role;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability_read_all" ON public.availability_blocks FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "availability_barber_manage" ON public.availability_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()));

-- ============ APPOINTMENTS ============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pendiente',
  reference_photo_url TEXT,
  description TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_barber_time ON public.appointments(barber_id, scheduled_at);
CREATE INDEX idx_appt_client ON public.appointments(client_id, scheduled_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appts_client_select" ON public.appointments FOR SELECT TO authenticated
  USING (client_id = auth.uid());
CREATE POLICY "appts_client_insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());
CREATE POLICY "appts_client_update" ON public.appointments FOR UPDATE TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "appts_barber_select" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()));
CREATE POLICY "appts_barber_update" ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.user_id = auth.uid()));

CREATE POLICY "appts_owner_all" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dueno'))
  WITH CHECK (public.has_role(auth.uid(),'dueno'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER appts_touch BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_self_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_self_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ AUTO PROFILE + CLIENT ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'cliente'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ NOTIFICATION TRIGGERS ============
CREATE OR REPLACE FUNCTION public.notify_appointment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  barber_user_id UUID;
  client_name TEXT;
  barber_name TEXT;
  svc_name TEXT;
  when_text TEXT;
BEGIN
  SELECT user_id INTO barber_user_id FROM public.barbers WHERE id = NEW.barber_id;
  SELECT name INTO barber_name FROM public.profiles WHERE id = barber_user_id;
  SELECT name INTO client_name FROM public.profiles WHERE id = NEW.client_id;
  SELECT name INTO svc_name FROM public.services WHERE id = NEW.service_id;
  when_text := to_char(NEW.scheduled_at AT TIME ZONE 'America/Asuncion', 'DD/MM/YYYY HH24:MI');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, title, body, type)
    VALUES (barber_user_id, 'Nueva solicitud de turno',
      'Solicitud de ' || COALESCE(client_name,'cliente') || ' para ' || COALESCE(svc_name,'servicio') || ' el ' || when_text,
      'nueva_solicitud');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'confirmado' THEN
      INSERT INTO public.notifications(user_id, title, body, type)
      VALUES (NEW.client_id, '¡Tu turno fue confirmado!',
        'Te esperamos el ' || when_text || ' con ' || COALESCE(barber_name,'tu barbero'),
        'confirmado');
    ELSIF NEW.status = 'rechazado' THEN
      INSERT INTO public.notifications(user_id, title, body, type)
      VALUES (NEW.client_id, 'Tu solicitud fue rechazada',
        'Podés intentar otro horario.', 'rechazado');
    ELSIF NEW.status = 'cancelado' THEN
      INSERT INTO public.notifications(user_id, title, body, type)
      VALUES (barber_user_id, 'Turno cancelado',
        COALESCE(client_name,'Un cliente') || ' canceló su turno del ' || when_text, 'cancelado');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER appts_notify_insert AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_change();
CREATE TRIGGER appts_notify_update AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_change();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ SEED SUCURSALES + SERVICIOS ============
INSERT INTO public.locations (name, address) VALUES
  ('Nueva Esperanza', 'Nueva Esperanza, Paraguay'),
  ('San Alberto', 'San Alberto, Paraguay');

INSERT INTO public.services (name, duration_minutes, price_gs) VALUES
  ('Corte', 40, 45000),
  ('Luces', 60, 200000),
  ('Barba', 30, 45000),
  ('Corte y Barba', 50, 80000),
  ('Barba Exprés', 20, 40000),
  ('Máquina general un peine', 30, 30000),
  ('Alisados de Cabello', 40, 50000),
  ('Hidratación de cabello', 25, 30000);
