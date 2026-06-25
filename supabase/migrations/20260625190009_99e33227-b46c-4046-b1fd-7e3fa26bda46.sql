
-- Storage policies for reference-photos (private bucket)
-- Path convention: <user_id>/<filename>

CREATE POLICY "ref_photos_owner_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reference-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ref_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reference-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ref_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reference-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ref_photos_barber_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reference-photos' AND public.has_role(auth.uid(),'barbero'));

CREATE POLICY "ref_photos_owner_role_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reference-photos' AND public.has_role(auth.uid(),'dueno'));
