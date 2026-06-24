
CREATE OR REPLACE FUNCTION public.accept_portal_invitation(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invite public.portal_invitations%ROWTYPE;
  _uid uuid := auth.uid();
  _user_email text;
  _policy_count int := 0;
  _invoice_count int := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _invite FROM public.portal_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF _invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', true, 'already_accepted', true);
  END IF;

  IF _invite.expires_at < now() THEN
    UPDATE public.portal_invitations SET status = 'expired' WHERE id = _invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = _uid;
  IF lower(_user_email) <> lower(_invite.email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  UPDATE public.portal_invitations
     SET status = 'accepted', user_id = _uid, accepted_at = now()
   WHERE id = _invite.id;

  -- Strikte koppeling: alleen polissen/facturen van het specifieke lead in de uitnodiging.
  IF _invite.lead_id IS NOT NULL THEN
    UPDATE public.policies SET user_id = _uid
     WHERE user_id IS NULL AND lead_id = _invite.lead_id;
    GET DIAGNOSTICS _policy_count = ROW_COUNT;

    UPDATE public.invoices SET user_id = _uid
     WHERE user_id IS NULL AND lead_id = _invite.lead_id;
    GET DIAGNOSTICS _invoice_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'policies_linked', _policy_count,
    'invoices_linked', _invoice_count
  );
END;
$function$;
