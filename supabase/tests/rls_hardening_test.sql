begin;
select plan(7);

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
reset role;

select ok(not has_table_privilege('authenticated','public.job_operation_closeouts','INSERT'),'authenticated cannot bypass closeout RPC with insert');
select ok(not has_table_privilege('authenticated','public.preflight_checklists','UPDATE'),'authenticated cannot bypass preflight approval with update');
select ok(has_function_privilege('anon','public.get_public_crew_briefing(text)','EXECUTE'),'anonymous capability-token lookup is available');

select * from finish();
rollback;
