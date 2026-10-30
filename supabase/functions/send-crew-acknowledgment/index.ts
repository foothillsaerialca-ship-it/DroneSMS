import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders(request: Request) {
  const configuredAppUrl = Deno.env.get('PUBLIC_APP_URL');
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? configuredAppUrl ?? '')
    .split(',').map((value) => value.trim()).filter(Boolean).flatMap((value) => {
      try { return [new URL(value).origin]; } catch { return []; }
    });
  const origin = request.headers.get('Origin') ?? '';
  const allowedOrigin = configuredOrigins.includes(origin) ? origin : configuredOrigins[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

type Invitation = {
  invitation_id: string;
  token: string;
  email: string;
  job_name: string;
  site: string | null;
  role: string;
  rpic_name: string;
};

function isInvitation(value: unknown): value is Invitation {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ['invitation_id', 'token', 'email', 'job_name', 'role', 'rpic_name']
    .every((key) => typeof record[key] === 'string');
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: cors });

  const correlationId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('PUBLIC_APP_URL');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl || !resendKey || !resendFrom) {
    console.error(JSON.stringify({ correlationId, event: 'crew_email_configuration_missing' }));
    return Response.json({ error: 'Acknowledgment email is temporarily unavailable.', correlationId }, { status: 503, headers: cors });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  if (!/^Bearer \S+$/.test(authorization)) {
    return Response.json({ error: 'Authentication is required.', correlationId }, { status: 401, headers: cors });
  }
  const token = authorization.slice('Bearer '.length);
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: 'Authentication is required.', correlationId }, { status: 401, headers: cors });
  }

  let assignmentId: string;
  try {
    const body = await request.json();
    assignmentId = body?.assignmentId;
    if (typeof assignmentId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignmentId)) {
      return Response.json({ error: 'A valid assignment ID is required.', correlationId }, { status: 400, headers: cors });
    }
  } catch {
    return Response.json({ error: 'A JSON request body is required.', correlationId }, { status: 400, headers: cors });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: invitation, error: invitationError } = await serviceClient.rpc('create_crew_briefing_invitation', {
    p_assignment_id: assignmentId,
    p_actor_user_id: userData.user.id,
  });
  if (invitationError || !isInvitation(invitation)) {
    console.error(JSON.stringify({ correlationId, event: 'crew_invitation_failed', message: invitationError?.message ?? 'invalid response' }));
    return Response.json({ error: 'Unable to create the acknowledgment request.', correlationId }, { status: invitationError ? 400 : 500, headers: cors });
  }

  const acknowledgeUrl = `${appUrl.replace(/\/$/, '')}/crew-briefing/acknowledge#token=${encodeURIComponent(invitation.token)}`;
  let sent = false;
  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': invitation.invitation_id },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        from: resendFrom,
        to: [invitation.email],
        subject: `Crew Briefing Acknowledgment - ${invitation.job_name}`,
        html: `<h2>DroneSMS Crew Briefing</h2><p>The RPIC has completed the crew briefing for:</p><p><strong>${escapeHtml(invitation.job_name)}</strong><br>${escapeHtml(invitation.site || 'Site not recorded')}<br>Role: ${escapeHtml(invitation.role)}<br>RPIC: ${escapeHtml(invitation.rpic_name)}</p><p>Please review the operation briefing and acknowledge that you participated in and understood the briefing.</p><p><a href="${escapeHtml(acknowledgeUrl)}">Review &amp; Acknowledge Briefing</a></p><p>Your acknowledgment will be recorded with the operation.</p>`,
      }),
    });
    if (!emailResponse.ok) throw new Error(`Email provider rejected the request (${emailResponse.status}).`);
    sent = true;
  } catch (error) {
    console.error(JSON.stringify({ correlationId, event: 'crew_email_failed', message: error instanceof Error ? error.message : 'unknown' }));
  }

  const { error: markError } = await serviceClient.rpc('mark_crew_briefing_email_result', {
    p_invitation_id: invitation.invitation_id,
    p_sent: sent,
  });
  if (markError) {
    console.error(JSON.stringify({ correlationId, event: 'crew_email_status_update_failed', message: markError.message, sent }));
    return Response.json({ error: 'Unable to confirm acknowledgment delivery.', correlationId }, { status: 500, headers: cors });
  }
  if (!sent) return Response.json({ error: 'Unable to send the acknowledgment request. Try again later.', correlationId }, { status: 502, headers: cors });
  return Response.json({ sent: true, correlationId }, { headers: cors });
});

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
}
