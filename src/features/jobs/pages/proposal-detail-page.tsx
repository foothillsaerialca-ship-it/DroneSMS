import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../integrations/supabase/client';
import { formatCurrency, formatDate, type ProposalStatus, proposalStatuses } from '../proposals';

type Proposal = {
  id: string;
  organization_id: string;
  user_id: string;
  client_name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  proposal_name: string;
  proposal_number: string | null;
  service_type: string;
  site_name: string | null;
  site_address: string;
  site_city: string | null;
  site_state: string | null;
  site_zip: string | null;
  scope_of_work: string | null;
  estimated_duration: string | null;
  crew_size: number | null;
  estimated_price: number | null;
  expiration_date: string | null;
  planned_equipment: string | null;
  planned_crew: string | null;
  hazard_selections: string[] | null;
  hazard_notes: string | null;
  preliminary_mitigations: string[] | null;
  status: ProposalStatus;
  created_at: string;
  converted_job_id: string | null;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function fullSiteAddress(proposal: Proposal) {
  return [proposal.site_address, proposal.site_city, proposal.site_state, proposal.site_zip].filter(Boolean).join(', ');
}

function proposalNumber(proposal: Proposal) {
  return proposal.proposal_number ?? `PROP-${proposal.id.slice(0, 8).toUpperCase()}`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? 'Not provided')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function ProposalDetailPage() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProposal() {
      if (!proposalId) {
        setError('Missing proposal id.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: loadError } = await supabase
          .from('proposals')
          .select('id, organization_id, user_id, client_name, company_name, contact_name, email, phone, proposal_name, proposal_number, service_type, site_name, site_address, site_city, site_state, site_zip, scope_of_work, estimated_duration, crew_size, estimated_price, expiration_date, planned_equipment, planned_crew, hazard_selections, hazard_notes, preliminary_mitigations, status, created_at, converted_job_id')
          .eq('id', proposalId)
          .maybeSingle();

        if (loadError) throw loadError;
        if (!isMounted) return;
        if (!data) {
          setError('Proposal not found.');
          setProposal(null);
          return;
        }

        setProposal(data as Proposal);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadProposal();
    return () => {
      isMounted = false;
    };
  }, [proposalId]);

  async function updateStatus(status: ProposalStatus) {
    if (!proposal) return;
    setIsUpdatingStatus(true);
    setError(null);
    setMessage(null);

    try {
      const { error: statusError } = await supabase
        .from('proposals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', proposal.id);
      if (statusError) throw statusError;
      setProposal({ ...proposal, status });
      setMessage('Proposal status updated.');
    } catch (statusError) {
      setError(getErrorMessage(statusError));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function convertToJob() {
    if (!proposal) return;
    if (proposal.converted_job_id) {
      navigate(`/jobs/${proposal.converted_job_id}`);
      return;
    }

    setIsConverting(true);
    setError(null);
    setMessage(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const notes = [
        `Converted from ${proposalNumber(proposal)}.`,
        `Client: ${proposal.client_name}${proposal.company_name ? ` (${proposal.company_name})` : ''}`,
        proposal.contact_name ? `Contact: ${proposal.contact_name}` : null,
        proposal.email ? `Email: ${proposal.email}` : null,
        proposal.phone ? `Phone: ${proposal.phone}` : null,
        proposal.scope_of_work ? `Scope: ${proposal.scope_of_work}` : null,
        proposal.planned_crew ? `Planned crew: ${proposal.planned_crew}` : null,
        proposal.planned_equipment ? `Planned equipment: ${proposal.planned_equipment}` : null,
        proposal.hazard_selections?.length ? `Preliminary hazards: ${proposal.hazard_selections.join(', ')}` : null,
        proposal.preliminary_mitigations?.length ? `Preliminary mitigations: ${proposal.preliminary_mitigations.join('; ')}` : null,
        proposal.hazard_notes ? `Hazard notes: ${proposal.hazard_notes}` : null
      ].filter(Boolean).join('\n');

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          organization_id: proposal.organization_id,
          user_id: proposal.user_id,
          proposal_id: proposal.id,
          name: proposal.proposal_name,
          service_type: proposal.service_type,
          location: fullSiteAddress(proposal),
          planned_date: today,
          notes,
          status: 'Planned',
          client_name: proposal.client_name,
          client_company_name: proposal.company_name,
          client_contact_name: proposal.contact_name,
          client_email: proposal.email,
          client_phone: proposal.phone,
          site_name: proposal.site_name,
          site_address: proposal.site_address,
          site_city: proposal.site_city,
          site_state: proposal.site_state,
          site_zip: proposal.site_zip,
          scope_of_work: proposal.scope_of_work,
          hazard_selections: proposal.hazard_selections ?? [],
          preliminary_mitigations: proposal.preliminary_mitigations ?? [],
          planned_crew: proposal.planned_crew,
          planned_equipment: proposal.planned_equipment
        })
        .select('id')
        .single();

      if (jobError) throw jobError;

      const convertedJobId = (job as { id: string }).id;
      const { error: proposalError } = await supabase
        .from('proposals')
        .update({ status: 'Awarded', converted_job_id: convertedJobId, converted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', proposal.id);
      if (proposalError) throw proposalError;

      navigate(`/jobs/${convertedJobId}`);
    } catch (conversionError) {
      setError(getErrorMessage(conversionError));
    } finally {
      setIsConverting(false);
    }
  }

  function openPrintableProposal() {
    if (!proposal) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const hazards = proposal.hazard_selections?.length ? proposal.hazard_selections : ['No preliminary hazards selected'];
    const mitigations = proposal.preliminary_mitigations?.length ? proposal.preliminary_mitigations : ['Mitigations will be finalized during JHA.'];
    const safeProposalNumber = escapeHtml(proposalNumber(proposal));
    const safeTitle = escapeHtml(proposal.proposal_name);
    const safeSiteAddress = escapeHtml(fullSiteAddress(proposal));
    win.document.write(`<!doctype html><html><head><title>${safeProposalNumber} ${safeTitle}</title><style>body{font-family:Inter,Arial,sans-serif;margin:0;color:#0f172a;background:#f8fafc}.page{max-width:820px;margin:24px auto;background:white;padding:42px;border:1px solid #e2e8f0}.header{display:flex;justify-content:space-between;gap:24px;border-bottom:4px solid #1d4ed8;padding-bottom:22px}.logo{font-size:30px;font-weight:800;color:#0f172a}.logo span{color:#1d4ed8}.meta{font-size:13px;text-align:right;line-height:1.7}.section{margin-top:28px}.section h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#1d4ed8;border-bottom:1px solid #dbeafe;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}.label{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700}.value{margin-top:4px;font-size:14px;white-space:pre-wrap}.price{font-size:28px;font-weight:800;color:#0f172a}.list{margin:8px 0 0 20px;padding:0}.accept{margin-top:36px;border:1px solid #cbd5e1;padding:18px}.lines{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}.line{border-top:1px solid #334155;padding-top:8px;font-size:12px;color:#475569}@media print{body{background:white}.page{margin:0;border:0;max-width:none}}</style></head><body><main class="page"><header class="header"><div><div class="logo">Drone<span>SMS</span></div><p>Professional UAS Operations Proposal</p></div><div class="meta"><strong>${safeProposalNumber}</strong><br>Date: ${escapeHtml(formatDate(proposal.created_at))}<br>Expiration: ${escapeHtml(formatDate(proposal.expiration_date))}</div></header><section class="section"><h2>Client Information</h2><div class="grid"><div><div class="label">Client</div><div class="value">${escapeHtml(proposal.client_name)}</div></div><div><div class="label">Company</div><div class="value">${escapeHtml(proposal.company_name)}</div></div><div><div class="label">Contact</div><div class="value">${escapeHtml(proposal.contact_name)}</div></div><div><div class="label">Email / Phone</div><div class="value">${escapeHtml(proposal.email)} / ${escapeHtml(proposal.phone)}</div></div></div></section><section class="section"><h2>Site Information</h2><div class="grid"><div><div class="label">Site</div><div class="value">${escapeHtml(proposal.site_name ?? proposal.proposal_name)}</div></div><div><div class="label">Address</div><div class="value">${safeSiteAddress}</div></div></div></section><section class="section"><h2>Scope of Work</h2><div class="value">${escapeHtml(proposal.scope_of_work ?? proposal.proposal_name)}</div></section><section class="section"><h2>Equipment Planned</h2><div class="value">${escapeHtml(proposal.planned_equipment ?? 'To be finalized before mission planning.')}</div></section><section class="section"><h2>Crew Planned</h2><div class="value">${escapeHtml(proposal.planned_crew ?? `${proposal.crew_size ?? 'TBD'} crew member(s)`)}</div></section><section class="section"><h2>Preliminary Hazards</h2><ul class="list">${hazards.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section class="section"><h2>Preliminary Mitigations</h2><ul class="list">${mitigations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section class="section"><h2>Pricing</h2><div class="price">${escapeHtml(formatCurrency(proposal.estimated_price))}</div><p>Estimated duration: ${escapeHtml(proposal.estimated_duration ?? 'To be scheduled')}</p></section><section class="accept"><h2>Acceptance Area</h2><p>By signing below, client authorizes DroneSMS to proceed with job scheduling and final safety planning.</p><div class="lines"><div class="line">Client Signature</div><div class="line">Date</div></div></section></main><script>window.print()</script></body></html>`);
    win.document.close();
  }

  if (isLoading) return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Loading proposal...</section>;

  if (error && !proposal) {
    return <section className="space-y-4"><Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/jobs?tab=proposals">Back to Proposals</Link><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm" role="alert">{error}</div></section>;
  }

  if (!proposal) return null;

  return (
    <section className="space-y-4">
      <Link className="text-sm font-medium text-brand-700 hover:text-brand-900" to="/jobs?tab=proposals">Back to Proposals</Link>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{proposalNumber(proposal)}</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{proposal.proposal_name}</h1>
            <p className="mt-2 text-sm text-slate-600">{proposal.client_name} · {proposal.service_type}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className="min-h-11 rounded-lg border border-brand-700 bg-white px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-50 sm:py-2" onClick={openPrintableProposal}>Generate PDF</button>
            <button type="button" className="min-h-11 rounded-lg bg-brand-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400 sm:py-2" onClick={() => void convertToJob()} disabled={isConverting}>{isConverting ? 'Converting...' : proposal.converted_job_id ? 'Open Job' : 'Convert to Job'}</button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{message}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <label className="block text-sm font-medium text-slate-700">Proposal Status<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100 sm:max-w-xs sm:py-2 sm:text-sm" value={proposal.status} onChange={(event) => void updateStatus(event.target.value as ProposalStatus)} disabled={isUpdatingStatus}>{proposalStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      </div>

      <InfoSection title="Client Information" items={[['Client Name', proposal.client_name], ['Company Name', proposal.company_name], ['Contact Name', proposal.contact_name], ['Email', proposal.email], ['Phone', proposal.phone]]} />
      <InfoSection title="Site Information" items={[['Site Name', proposal.site_name], ['Site Address', fullSiteAddress(proposal)]]} />
      <InfoSection title="Proposal Details" items={[['Scope of Work', proposal.scope_of_work], ['Estimated Duration', proposal.estimated_duration], ['Crew Size', proposal.crew_size?.toString() ?? null], ['Estimated Price', formatCurrency(proposal.estimated_price)], ['Expiration Date', formatDate(proposal.expiration_date)]]} />
      <ListSection title="Preliminary Hazards" items={proposal.hazard_selections ?? []} empty="No hazards selected." />
      <ListSection title="Preliminary Mitigations" items={proposal.preliminary_mitigations ?? []} empty="No mitigations recorded." />
    </section>
  );
}

function InfoSection({ title, items }: { title: string; items: [string, string | null][] }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-base font-semibold text-brand-900">{title}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{items.map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{value || 'Not provided'}</dd></div>)}</dl></section>;
}

function ListSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-base font-semibold text-brand-900">{title}</h2>{items.length > 0 ? <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-4 text-sm text-slate-600">{empty}</p>}</section>;
}
