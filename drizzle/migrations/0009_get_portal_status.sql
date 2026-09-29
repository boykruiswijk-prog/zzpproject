CREATE OR REPLACE FUNCTION public.get_portal_status(_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'uitgenodigd_op', (SELECT max(created_at) FROM public.portal_invitations WHERE lead_id = _lead_id),
    'laatst_ingelogd', (SELECT max(u.last_sign_in_at) FROM auth.users u
                          JOIN public.policies p ON p.user_id = u.id WHERE p.lead_id = _lead_id),
    'laatste_fout', (SELECT jsonb_build_object('op', n.created_at, 'melding', n.error_message)
                       FROM public.lead_notification_log n
                      WHERE n.lead_id = _lead_id AND n.lead_type IN ('portal_invite','portal_invite_auto')
                      ORDER BY n.created_at DESC LIMIT 1
                      ) 
  ) INTO r;
  -- Alleen tonen als de laatste poging mislukt is
  IF (SELECT n.status FROM public.lead_notification_log n
       WHERE n.lead_id = _lead_id AND n.lead_type IN ('portal_invite','portal_invite_auto')
       ORDER BY n.created_at DESC LIMIT 1) IS DISTINCT FROM 'failed' THEN
    r := r - 'laatste_fout';
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.get_portal_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_status(uuid) TO authenticated;