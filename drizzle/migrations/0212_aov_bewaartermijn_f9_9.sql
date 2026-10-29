ALTER TABLE public.aov_aanmeldingen ADD COLUMN laatst_contact_op timestamptz NOT NULL DEFAULT now(), ADD COLUMN geanonimiseerd_op timestamptz;
ALTER TABLE public.aov_doorverwijzingen ADD COLUMN laatst_contact_op timestamptz NOT NULL DEFAULT now(), ADD COLUMN geanonimiseerd_op timestamptz;
UPDATE public.aov_aanmeldingen SET laatst_contact_op = greatest(created_at, behandeld_op);
UPDATE public.aov_doorverwijzingen d SET laatst_contact_op = greatest(d.created_at, (SELECT a.laatst_contact_op FROM public.aov_aanmeldingen a WHERE a.id=d.klik_id));
ALTER TABLE public.aov_aanmeldingen DROP CONSTRAINT aov_aanmeldingen_naam_check, DROP CONSTRAINT aov_aanmeldingen_email_check;
ALTER TABLE public.aov_aanmeldingen ADD CONSTRAINT aov_aanmeldingen_naam_check CHECK ((geanonimiseerd_op IS NOT NULL AND naam='') OR char_length(btrim(naam)) BETWEEN 2 AND 120), ADD CONSTRAINT aov_aanmeldingen_email_check CHECK ((geanonimiseerd_op IS NOT NULL AND email='') OR (char_length(email)<=254 AND email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'));
CREATE FUNCTION public.aov_contact_bewaar() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.geanonimiseerd_op IS NULL AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.notitie IS DISTINCT FROM OLD.notitie OR NEW.behandeld_op IS DISTINCT FROM OLD.behandeld_op) THEN
  NEW.laatst_contact_op := greatest(NEW.laatst_contact_op, now());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.aov_contact_bewaar() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER aov_contact_bewaar BEFORE UPDATE ON public.aov_aanmeldingen FOR EACH ROW EXECUTE FUNCTION public.aov_contact_bewaar();
CREATE FUNCTION public.aov_anonimiseer_verlopen() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.aov_doorverwijzingen d SET user_id=NULL, klant_ref=NULL, bron='geanonimiseerd', geanonimiseerd_op=now()
 WHERE d.geanonimiseerd_op IS NULL AND greatest(d.laatst_contact_op, (SELECT a.laatst_contact_op FROM public.aov_aanmeldingen a WHERE a.id=d.klik_id)) < now()-interval '2 years';
 UPDATE public.aov_aanmeldingen SET naam='',email='',telefoon=NULL,user_id=NULL,notitie=NULL,behandeld_door=NULL,bron='geanonimiseerd',geanonimiseerd_op=now()
 WHERE geanonimiseerd_op IS NULL AND laatst_contact_op < now()-interval '2 years';
END $$;
REVOKE ALL ON FUNCTION public.aov_anonimiseer_verlopen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aov_anonimiseer_verlopen() TO service_role;
SELECT cron.schedule('aov-anonimiseer-verlopen','20 2 * * *','SELECT public.aov_anonimiseer_verlopen();');
COMMENT ON COLUMN public.aov_aanmeldingen.laatst_contact_op IS 'AOV-only retention clock: signup contact, explicit last-contact updates, and conservative extension on team handling. No other customer data is affected.';