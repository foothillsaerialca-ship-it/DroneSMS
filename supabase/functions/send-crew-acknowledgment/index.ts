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

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: cors });
  const correlationId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const appUrl = Deno.env.get('PUBLIC_APP_URL');
  if (!supabaseUrl || !anonKey || !appUrl) {
    console.error(JSON.stringify({ correlationId, event: 'crew_email_configuration_missing' }));
    return Response.json({ error: 'Acknowledgment email is temporarily unavailable.', correlationId }, { status: 503, headers: cors });
  }
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return Response.json({ error: 'Authentication is required.', correlationId }, { status: 401, headers: cors });
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  let invitationId: string | undefined;
  try {
    const { assignmentId } = await request.json();
    if (typeof assignmentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(assignmentId)) throw new Error('invalid_assignment');
    const { data, error } = await client.rpc('create_crew_briefing_invitation', { p_assignment_id: assignmentId });
    if (error) throw error;
    invitationId = data.invitation_id;
    const acknowledgeUrl = `${appUrl.replace(/\/$/, '')}/crew-briefing/acknowledge#token=${encodeURIComponent(data.token)}`;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Transactional email is not configured.');
    const resendFrom = Deno.env.get('RESEND_FROM');
    if (!resendFrom) throw new Error('Transactional email sender is not configured.');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': invitationId },
      body: JSON.stringify({
        from: resendFrom, to: [data.email],
        subject: `Crew Briefing Acknowledgment — ${data.job_name}`,
        html: `<h2>DroneSMS Crew Briefing</h2><p>The RPIC has completed the crew briefing for:</p><p><strong>${escapeHtml(data.job_name)}</strong><br>${escapeHtml(data.site || 'Site not recorded')}<br>Role: ${escapeHtml(data.role)}<br>RPIC: ${escapeHtml(data.rpic_name)}</p><p>Please review the operation briefing and acknowledge that you participated in and understood the briefing.</p><p><a href="${escapeHtml(acknowledgeUrl)}">Review &amp; Acknowledge Briefing</a></p><p>Your acknowledgment will be recorded with the operation.</p>`,
      }),
    });
    if (!emailResponse.ok) throw new Error(`Email provider rejected the request (${emailResponse.status}).`);
    const { error: markError } = await client.rpc('mark_crew_briefing_email_result', { p_invitation_id: invitationId, p_sent: true });
    if (markError) throw markError;
    return Response.json({ sent: true, correlationId }, { headers: cors });
  } catch (error) {
    if (invitationId) await client.rpc('mark_crew_briefing_email_result', { p_invitation_id: invitationId, p_sent: false });
    console.error(JSON.stringify({ correlationId, event: 'crew_email_failed', message: error instanceof Error ? error.message : 'unknown' }));
    return Response.json({ error: 'Unable to send the acknowledgment request. Try again later.', correlationId }, { status: 400, headers: cors });
  }
});

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
}
