-- Security Advisor audit: PostgreSQL grants EXECUTE to PUBLIC when a function is
-- created unless it is explicitly revoked.  Narrow client-callable RPCs to the
-- roles that actually call them; trigger functions continue to execute as their
-- SECURITY DEFINER owner and therefore need no client EXECUTE privilege.

-- Authenticated policy helpers. These are intentionally callable while evaluating
-- authenticated RLS policies, but disclose only the caller's organization/role.
revoke all on function public.current_user_organization_id() from public, anon;
grant execute on function public.current_user_organization_id() to authenticated;
revoke all on function public.is_organization_safety_manager(uuid) from public, anon;
grant execute on function public.is_organization_safety_manager(uuid) to authenticated;

-- Authenticated business RPCs. Each implementation binds the operation to
-- auth.uid() and the caller's organization and/or assigned operational role.
revoke all on function public.accept_operational_jha_as_rpic(uuid) from public, anon;
grant execute on function public.accept_operational_jha_as_rpic(uuid) to authenticated;
revoke all on function public.review_operational_jha_as_safety_manager(uuid) from public, anon;
grant execute on function public.review_operational_jha_as_safety_manager(uuid) to authenticated;
revoke all on function public.start_management_of_change(text,text,text,text,uuid,uuid,text,uuid) from public, anon;
grant execute on function public.start_management_of_change(text,text,text,text,uuid,uuid,text,uuid) to authenticated;
revoke all on function public.approve_management_of_change(uuid,text,text) from public, anon;
grant execute on function public.approve_management_of_change(uuid,text,text) to authenticated;
revoke all on function public.correct_completed_management_of_change(uuid,jsonb,text) from public, anon;
grant execute on function public.correct_completed_management_of_change(uuid,jsonb,text) to authenticated;
revoke all on function public.save_operation_closeout_with_assurance(uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]) from public, anon;
grant execute on function public.save_operation_closeout_with_assurance(uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]) to authenticated;
revoke all on function public.complete_safety_assurance_review(uuid,text,jsonb) from public, anon;
grant execute on function public.complete_safety_assurance_review(uuid,text,jsonb) to authenticated;
revoke all on function public.confirm_job_ready_to_operate(uuid,boolean) from public, anon;
grant execute on function public.confirm_job_ready_to_operate(uuid,boolean) to authenticated;
revoke all on function public.create_crew_briefing_invitation(uuid) from public, anon;
grant execute on function public.create_crew_briefing_invitation(uuid) to authenticated;
revoke all on function public.mark_crew_briefing_email_result(uuid,boolean) from public, anon;
grant execute on function public.mark_crew_briefing_email_result(uuid,boolean) to authenticated;
revoke all on function public.record_manual_field_briefing(uuid,text,text,boolean) from public, anon;
grant execute on function public.record_manual_field_briefing(uuid,text,text,boolean) to authenticated;

-- Token possession is the authorization mechanism for these two no-login RPCs.
-- PUBLIC is still revoked so only the named API roles, not every future role,
-- inherit access.
revoke all on function public.get_public_crew_briefing(text) from public;
grant execute on function public.get_public_crew_briefing(text) to anon, authenticated;
revoke all on function public.acknowledge_public_crew_briefing(text,text) from public;
grant execute on function public.acknowledge_public_crew_briefing(text,text) to anon, authenticated;

-- Trigger/internal helpers are invoked by their owning SECURITY DEFINER caller,
-- not through PostgREST. Revoking client roles does not affect trigger execution.
revoke all on function public.capture_custom_hazard_reviews() from public, anon, authenticated;
revoke all on function public.capture_safety_event_review() from public, anon, authenticated;
revoke all on function public.log_moc_change() from public, anon, authenticated;
revoke all on function public.log_moc_child_change() from public, anon, authenticated;
revoke all on function public.crew_briefing_assigned_rpic(uuid) from public, anon, authenticated;

-- Lock every effective SECURITY DEFINER function to trusted schemas. Object names
-- in function bodies are schema-qualified; pg_catalog is explicit for built-ins.
alter function public.current_user_organization_id() set search_path = pg_catalog, public;
alter function public.capture_custom_hazard_reviews() set search_path = pg_catalog, public;
alter function public.capture_safety_event_review() set search_path = pg_catalog, public;
alter function public.review_operational_jha_as_safety_manager(uuid) set search_path = pg_catalog, public;
alter function public.accept_operational_jha_as_rpic(uuid) set search_path = pg_catalog, public;
alter function public.is_organization_safety_manager(uuid) set search_path = pg_catalog, public;
alter function public.log_moc_change() set search_path = pg_catalog, public;
alter function public.log_moc_child_change() set search_path = pg_catalog, public;
alter function public.correct_completed_management_of_change(uuid,jsonb,text) set search_path = pg_catalog, public;
alter function public.start_management_of_change(text,text,text,text,uuid,uuid,text,uuid) set search_path = pg_catalog, public;
alter function public.approve_management_of_change(uuid,text,text) set search_path = pg_catalog, public;
alter function public.mark_job_operation_readiness_stale(uuid,text) set search_path = pg_catalog, public;
alter function public.confirm_job_ready_to_operate(uuid,boolean) set search_path = pg_catalog, public;
alter function public.save_operation_closeout_with_assurance(uuid,text,text,text,text,text,boolean,text,boolean,text[],text[],text[],uuid[]) set search_path = pg_catalog, public;
alter function public.complete_safety_assurance_review(uuid,text,jsonb) set search_path = pg_catalog, public;
alter function public.crew_briefing_assigned_rpic(uuid) set search_path = pg_catalog, public;
alter function public.create_crew_briefing_invitation(uuid) set search_path = pg_catalog, public;
alter function public.mark_crew_briefing_email_result(uuid,boolean) set search_path = pg_catalog, public;
alter function public.record_manual_field_briefing(uuid,text,text,boolean) set search_path = pg_catalog, public;
alter function public.get_public_crew_briefing(text) set search_path = pg_catalog, public;
alter function public.acknowledge_public_crew_briefing(text,text) set search_path = pg_catalog, public;

-- Public object URLs are served by the public bucket endpoint and do not require
-- a storage.objects SELECT policy. Removing this policy prevents authenticated
-- clients from enumerating every organization's object metadata while preserving
-- existing getPublicUrl-based image display.
drop policy if exists "Users can view organization logos" on storage.objects;
