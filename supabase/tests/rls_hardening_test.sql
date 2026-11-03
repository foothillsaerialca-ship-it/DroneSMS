begin;
select plan(19);

insert into auth.users(id,email,aud,role) values
  ('10000000-0000-0000-0000-000000000001','owner-a@example.test','authenticated','authenticated'),
  ('10000000-0000-0000-0000-000000000002','owner-b@example.test','authenticated','authenticated'),
  ('10000000-0000-0000-0000-000000000003','reader-a@example.test','authenticated','authenticated');

insert into public.organizations(id,name,owner_user_id) values
  ('20000000-0000-0000-0000-000000000001','Tenant A','10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002','Tenant B','10000000-0000-0000-0000-000000000002');
insert into public.organization_memberships(organization_id,user_id,role,status,accepted_at) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','read_only','active',now());
insert into public.profiles(id,organization_id,company_name) values
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Tenant A'),
  ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Tenant B'),
  ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Tenant A');
insert into public.jobs(id,organization_id,user_id,name,service_type,location,planned_date,status) values
  ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Tenant B private job','Other','Private site',current_date,'Planned');
insert into public.personnel(id,organization_id,user_id,created_by_user_id,full_name) values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',null,'10000000-0000-0000-0000-000000000001','Tenant A Crew');
insert into public.personnel(id,organization_id,user_id,created_by_user_id,full_name) values
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',null,'10000000-0000-0000-0000-000000000002','Tenant B Crew');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner-a@example.test"}',true);
select throws_ok(
  $$update public.profiles set organization_id='20000000-0000-0000-0000-000000000002' where id='10000000-0000-0000-0000-000000000001'$$,
  'P0001','An accepted organization membership is required.','a profile cannot self-assign another tenant'
);
select is((select count(*)::integer from public.jobs where id='30000000-0000-0000-0000-000000000002'),0,'tenant A cannot read tenant B jobs');

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"reader-a@example.test"}',true);
select throws_ok(
  $$insert into public.jobs(organization_id,user_id,name,service_type,location,planned_date,status) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Forbidden','Other','Site',current_date,'Planned')$$,
  'P0001','Your organization role is read-only for this operation.','read-only members cannot create jobs'
);
select throws_ok(
  $$select public.list_organization_members()$$,
  'P0001','Owner or administrator access is required.','read-only members cannot enumerate auth emails'
);
select is((select count(*)::integer from public.personnel where id='40000000-0000-0000-0000-000000000001'),1,'organization members can read their personnel roster');
select is((select count(*)::integer from public.personnel where id='40000000-0000-0000-0000-000000000002'),0,'organization members cannot read another tenant personnel');
reset role;

select ok(not has_table_privilege('authenticated','public.job_operation_closeouts','INSERT'),'authenticated cannot bypass closeout RPC with insert');
select ok(not has_table_privilege('authenticated','public.preflight_checklists','UPDATE'),'authenticated cannot bypass preflight approval with update');
select ok(has_function_privilege('anon','public.get_public_crew_briefing(text)','EXECUTE'),'anonymous capability-token lookup is available');
select ok(to_regprocedure('public.create_crew_briefing_invitation(uuid)') is null,'legacy invitation RPC cannot disclose raw tokens');
select ok(not has_function_privilege('authenticated','public.create_crew_briefing_invitation(uuid,uuid)','EXECUTE'),'authenticated clients cannot mint raw invitation tokens');
select ok(has_function_privilege('service_role','public.create_crew_briefing_invitation(uuid,uuid)','EXECUTE'),'trusted email service can create invitations');
select ok(not has_function_privilege('authenticated','public.mark_crew_briefing_email_result(uuid,boolean)','EXECUTE'),'authenticated clients cannot assert email delivery');
select ok(has_function_privilege('service_role','public.mark_crew_briefing_email_result(uuid,boolean)','EXECUTE'),'trusted email service can record delivery');
select ok(not has_function_privilege('authenticated','public.claim_storage_cleanup_batch(integer)','EXECUTE'),'authenticated clients cannot claim cleanup work');
select ok(has_function_privilege('service_role','public.claim_storage_cleanup_batch(integer)','EXECUTE'),'trusted cleanup service can claim cleanup work');

insert into public.storage_cleanup_queue(id,bucket_id,object_path,reason,delete_after,status,attempts,claimed_at)
values('50000000-0000-0000-0000-000000000001','test-bucket','abandoned.txt','Lease recovery test',now()-interval '1 day','processing',1,now()-interval '20 minutes');
insert into public.storage_cleanup_queue(id,bucket_id,object_path,reason,delete_after,status,attempts,claimed_at)
values('50000000-0000-0000-0000-000000000002','test-bucket','exhausted.txt','Lease recovery test',now()-interval '1 day','processing',5,now()-interval '20 minutes');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select * from public.claim_storage_cleanup_batch(100)$$,'service worker reclaims abandoned cleanup work');
reset role;
select is((select attempts from public.storage_cleanup_queue where id='50000000-0000-0000-0000-000000000001'),2,'reclaimed work receives a new fenced attempt number');
select is((select status from public.storage_cleanup_queue where id='50000000-0000-0000-0000-000000000002'),'failed','exhausted abandoned work is visible for manual reconciliation');

select * from finish();
rollback;
