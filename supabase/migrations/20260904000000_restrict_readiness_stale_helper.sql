-- Internal readiness invalidation helper. Trigger functions and trusted definer
-- workflows execute with the function owner's privileges; client roles must not
-- be able to stale an operation directly.
revoke execute on function public.mark_job_operation_readiness_stale(uuid, text) from public;
revoke execute on function public.mark_job_operation_readiness_stale(uuid, text) from anon;
revoke execute on function public.mark_job_operation_readiness_stale(uuid, text) from authenticated;
