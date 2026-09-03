import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const authorization = request.headers.get('Authorization') ?? '';
  const client = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  let invitationId: string | undefined;
  try {
    const { assignmentId } = await request.json();
    const { data, error } = await client.rpc('create_crew_briefing_invitation', { p_assignment_id: assignmentId });
    if (error) throw error;
    invitationId = data.invitation_id;
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? new URL(request.url).origin;
    const acknowledgeUrl = `${appUrl.replace(/\/$/, '')}/crew-briefing/acknowledge?token=${encodeURIComponent(data.token)}`;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Transactional email is not configured.');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'DroneSMS Crew Briefing <briefing@dronesms.app>', to: [data.email],
        subject: `Crew Briefing Acknowledgment — ${data.job_name}`,
        html: `<h2>DroneSMS Crew Briefing</h2><p>The RPIC has completed the crew briefing for:</p><p><strong>${escapeHtml(data.job_name)}</strong><br>${escapeHtml(data.site || 'Site not recorded')}<br>Role: ${escapeHtml(data.role)}<br>RPIC: ${escapeHtml(data.rpic_name)}</p><p>Please review the operation briefing and acknowledge that you participated in and understood the briefing.</p><p><a href="${acknowledgeUrl}">Review &amp; Acknowledge Briefing</a></p><p>Your acknowledgment will be recorded with the operation.</p>`,
      }),
    });
    if (!emailResponse.ok) throw new Error(`Email provider rejected the request (${emailResponse.status}).`);
    const { error: markError } = await client.rpc('mark_crew_briefing_email_result', { p_invitation_id: invitationId, p_sent: true });
    if (markError) throw markError;
    return Response.json({ sent: true }, { headers: cors });
  } catch (error) {
    if (invitationId) await client.rpc('mark_crew_briefing_email_result', { p_invitation_id: invitationId, p_sent: false });
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to send acknowledgment.' }, { status: 400, headers: cors });
  }
});

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
}
