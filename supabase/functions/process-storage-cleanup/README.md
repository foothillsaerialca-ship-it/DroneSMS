# Storage cleanup worker

Deploy this Edge Function with JWT verification disabled only when the endpoint is
protected by a long random `STORAGE_CLEANUP_SECRET`. Invoke it from the platform
scheduler with `POST` and the secret in `x-cleanup-secret`.

The worker removes at most 100 due objects per invocation. Database triggers place
replaced/deleted objects in `storage_cleanup_queue` with a recovery grace period.
Failed objects are retried up to five times and remain visible to operators for
manual reconciliation.
