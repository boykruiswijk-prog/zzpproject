REVOKE ALL ON TABLE public.articles_backup_20261005 FROM PUBLIC;
REVOKE ALL ON TABLE public.articles_backup_20261005 FROM anon;
REVOKE ALL ON TABLE public.articles_backup_20261005 FROM authenticated;
REVOKE ALL ON TABLE public.articles_backup_20261005 FROM sandbox_exec;
REVOKE ALL ON TABLE public.articles_backup_20261005 FROM sandbox_exec_eugkavokktjwpqaqlwsj;
GRANT ALL ON TABLE public.articles_backup_20261005 TO service_role;