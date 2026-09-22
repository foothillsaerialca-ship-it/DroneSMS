import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CleanupItem = {
  id: string;
  bucket_id: string;
  object_path: string;
};

Deno.serve(async (request) => {
  const correlationId = crypto.randomUUID();
  if (request.method !== "POST")
    return Response.json(
      { error: "Method not allowed.", correlationId },
      { status: 405 },
    );

  const expectedSecret = Deno.env.get("STORAGE_CLEANUP_SECRET");
  const suppliedSecret = request.headers.get("x-cleanup-secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return Response.json(
      { error: "Unauthorized.", correlationId },
      { status: 401 },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      JSON.stringify({
        correlationId,
        event: "storage_cleanup_configuration_missing",
      }),
    );
    return Response.json(
      { error: "Cleanup service is not configured.", correlationId },
      { status: 503 },
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.rpc("claim_storage_cleanup_batch", {
    p_batch_limit: 100,
  });

  if (error) {
    console.error(
      JSON.stringify({
        correlationId,
        event: "storage_cleanup_queue_load_failed",
        message: error.message,
      }),
    );
    return Response.json(
      { error: "Unable to load cleanup work.", correlationId },
      { status: 500 },
    );
  }

  let deleted = 0;
  let failed = 0;
  for (const item of (data ?? []) as CleanupItem[]) {
    const { error: removeError } = await client.storage
      .from(item.bucket_id)
      .remove([item.object_path]);
    if (removeError) {
      failed += 1;
      await client
        .from("storage_cleanup_queue")
        .update({
          status: "failed",
          last_error: removeError.message.slice(0, 500),
        })
        .eq("id", item.id);
      continue;
    }
    deleted += 1;
    await client
      .from("storage_cleanup_queue")
      .update({ status: "deleted", processed_at: new Date().toISOString() })
      .eq("id", item.id);
  }

  console.log(
    JSON.stringify({
      correlationId,
      event: "storage_cleanup_complete",
      selected: data?.length ?? 0,
      deleted,
      failed,
    }),
  );
  return Response.json({
    selected: data?.length ?? 0,
    deleted,
    failed,
    correlationId,
  });
});
