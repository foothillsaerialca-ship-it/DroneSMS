import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

export type LegalDocumentKind = 'privacy' | 'terms';

const documentTitles: Record<LegalDocumentKind, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

function LegalDocumentContent({ document }: { document: LegalDocumentKind }) {
  if (document === 'privacy') {
    return (
      <div className="space-y-5 text-sm leading-6 text-slate-700">
        <p><strong>Effective date: October 30, 2026. Version: 2026-10-30-v1.</strong></p>
        <p>This Privacy Policy describes how DroneSMS handles information when you use the DroneSMS application and related support services. DroneSMS is an operational safety-management tool for commercial drone operators. This policy is a product disclosure, not legal advice; your organization remains responsible for its own privacy notices and legal obligations.</p>
        <section><h3 className="font-semibold text-slate-900">Information we process</h3><ul className="list-disc space-y-1 pl-5"><li>Account details such as sign-in email, authentication identifiers, names, and account-security state.</li><li>Organization and business details, including company contact information, branding, settings, and membership relationships.</li><li>Operational records entered by users, including proposals, job schedules and locations, personnel and crew assignments, aircraft and equipment records, JHAs, airspace and weather evidence, pre-flight checks, safety events, closeouts, acknowledgements, and corrective-action or change-management records.</li><li>Files and evidence users choose to upload, such as photographs, equipment references, and organization logos.</li><li>Technical and security information needed to operate the service, such as authentication/session data, service logs, request metadata, and abuse-prevention signals.</li></ul></section>
        <section><h3 className="font-semibold text-slate-900">How information is used</h3><p>We use information to authenticate users, provide organization-scoped workflows, preserve safety and audit records, generate requested documents, secure and troubleshoot the service, respond to support requests, and meet legal obligations. We do not use operational records to provide flight-control or airspace-authorization services.</p></section>
        <section><h3 className="font-semibold text-slate-900">Sharing and service providers</h3><p>Information is available to authorized members of the organization that records or receives it, subject to access controls. DroneSMS relies on Supabase for authentication, database, and storage services and Cloudflare for application hosting and delivery. Providers process information to supply their services under their own contractual and security terms. We may disclose information when legally required, to protect users or the service, or as part of a business transfer. We do not sell personal information.</p></section>
        <section><h3 className="font-semibold text-slate-900">Storage, security, and retention</h3><p>Data is stored using the configured service providers and access controls, including organization-scoped database policies. We use reasonable technical and organizational safeguards, but no internet service can promise absolute security. Operational and safety records may be retained while an organization account is active and as needed for service integrity, legal obligations, dispute resolution, backups, and security. Deletion from active systems may not immediately remove copies in protected backups or records that must be retained.</p></section>
        <section><h3 className="font-semibold text-slate-900">Your choices and requests</h3><p>Users should contact their organization administrator for access, correction, or deletion of organization-managed records. For account, privacy, or support requests, contact <a className="font-medium text-brand-700 underline" href="mailto:support@dronesms.app">support@dronesms.app</a>. We will review requests and respond as required by applicable law and operational retention needs.</p></section>
        <section><h3 className="font-semibold text-slate-900">Children and changes</h3><p>DroneSMS is intended for business use and is not directed to children. We may update this policy as the service changes. When a material update requires renewed acceptance, the service will record a new policy version and ask users to review it before continuing.</p></section>
        <section><h3 className="font-semibold text-slate-900">Contact</h3><p>Questions about this policy may be sent to <a className="font-medium text-brand-700 underline" href="mailto:support@dronesms.app">support@dronesms.app</a>.</p></section>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-sm leading-6 text-slate-700">
      <p><strong>Effective date: October 30, 2026. Version: 2026-10-30-v1.</strong></p>
      <p>These Terms of Service govern access to DroneSMS, a software tool for planning, documenting, and managing commercial drone operations. By accepting these Terms, you represent that you are authorized to act for yourself or your organization. If you do not agree, do not use the authenticated service.</p>
      <section><h3 className="font-semibold text-slate-900">Service role and operational responsibility</h3><p>DroneSMS provides recordkeeping, workflow, and safety-management support. It is not a flight-control system, airspace determination service, authorization provider, weather service, aircraft inspection, legal advice, or a substitute for an operator's safety-management system. The application may rely on user-entered or incomplete information and may not reflect current regulations, airspace restrictions, weather, manufacturer instructions, or site conditions.</p><p>You and your organization remain solely responsible for determining whether an operation may proceed, obtaining required approvals, ensuring pilot qualifications and aircraft condition, evaluating site hazards and weather, complying with applicable law and manufacturer instructions, filing required reports, and exercising stop-work authority. Never rely on an application status alone to launch or continue a flight.</p></section>
      <section><h3 className="font-semibold text-slate-900">Accounts and authorized use</h3><p>Keep account credentials secure, provide accurate information, and promptly report suspected unauthorized access. You are responsible for activity under your account and for ensuring that people you invite are authorized to access the information they receive. Do not bypass security controls, access another organization's data, disrupt the service, upload malicious content, or use the service unlawfully.</p></section>
      <section><h3 className="font-semibold text-slate-900">Your information and records</h3><p>You or your organization retain responsibility for the content submitted to DroneSMS, including its accuracy, permissions, and lawful basis. You grant DroneSMS a limited right to host, process, display, and back up that content as needed to provide and secure the service. Do not upload information you are not authorized to provide. Organization administrators control access to organization records. Retention and deletion may be subject to backups, security, legal obligations, and operational recordkeeping needs.</p></section>
      <section><h3 className="font-semibold text-slate-900">Availability and changes</h3><p>We may maintain, modify, suspend, or discontinue features, and may restrict access when reasonably needed for security, legal compliance, or service integrity. We do not guarantee uninterrupted or error-free availability. We will use reasonable efforts to communicate material service changes through the application or other appropriate channels.</p></section>
      <section><h3 className="font-semibold text-slate-900">Intellectual property</h3><p>DroneSMS and its software, branding, and service materials are owned by DroneSMS or its licensors. Subject to these Terms, you receive a limited, non-exclusive, non-transferable right to use the service for your internal business operations. Third-party components remain subject to their own licenses. <a className="font-medium text-brand-700 underline" href="/vendor-licenses.txt" target="_blank" rel="noreferrer">Review bundled third-party license notices</a>.</p></section>
      <section><h3 className="font-semibold text-slate-900">Disclaimer and limitation</h3><p>To the extent permitted by law, the service is provided “as is” and “as available,” without warranties that it will be uninterrupted, error-free, or satisfy every regulatory or operational need. To the extent permitted by law, DroneSMS will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, profits, operations, or goodwill arising from use of the service. Nothing in these Terms excludes liability that applicable law does not allow to be excluded.</p></section>
      <section><h3 className="font-semibold text-slate-900">Termination and updates to these Terms</h3><p>You may stop using the service at any time. Access may be suspended or terminated for material violation, security risk, legal requirement, or service discontinuation. We may revise these Terms; where renewed acceptance is required, the application will show the updated version and require review before authenticated use continues.</p></section>
      <section><h3 className="font-semibold text-slate-900">General</h3><p>These Terms and the Privacy Policy describe the current service relationship and do not create an agency, employment, or partnership relationship. If any provision is unenforceable, the remaining provisions remain in effect to the extent allowed by law. Applicable law and venue depend on the operator of DroneSMS and will be specified in a future counsel-reviewed revision; nothing here limits non-waivable consumer or statutory rights.</p></section>
      <section><h3 className="font-semibold text-slate-900">Contact</h3><p>Questions about these Terms may be sent to <a className="font-medium text-brand-700 underline" href="mailto:support@dronesms.app">support@dronesms.app</a>.</p></section>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">These Terms are an initial product draft and should be reviewed by qualified counsel before production or commercial reliance.</p>
    </div>
  );
}

export function LegalDocumentViewer({
  initialDocument,
  onClose,
}: {
  initialDocument: LegalDocumentKind;
  onClose: () => void;
}) {
  const [document, setDocument] = useState(initialDocument);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="legal-document-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-6">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">DroneSMS Legal</p><h2 id="legal-document-title" className="mt-1 text-xl font-semibold text-brand-900">{documentTitles[document]}</h2></div>
          <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onClose}>Close</button>
        </header>
        <nav className="flex gap-2 border-b border-slate-200 px-4 py-3 sm:px-6" aria-label="Legal documents">
          {(['privacy', 'terms'] as const).map((kind) => <button key={kind} type="button" className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold ${document === kind ? 'bg-brand-700 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`} aria-current={document === kind ? 'page' : undefined} onClick={() => setDocument(kind)}>{documentTitles[kind]}</button>)}
        </nav>
        <div className="overflow-y-auto p-4 sm:p-6"><LegalDocumentContent document={document} /></div>
      </section>
    </div>
  );
}

type ConsentStatus = {
  terms_version: string;
  privacy_version: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
};

type GateState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'accepted' }
  | { kind: 'required'; termsVersion: string; privacyVersion: string };

function parseConsentStatus(value: unknown): ConsentStatus {
  if (!value || typeof value !== 'object') throw new Error('The legal consent status response was invalid.');
  const record = value as Record<string, unknown>;
  if (
    typeof record.terms_version !== 'string'
    || typeof record.privacy_version !== 'string'
    || typeof record.terms_accepted !== 'boolean'
    || typeof record.privacy_accepted !== 'boolean'
  ) throw new Error('The legal consent status response was incomplete.');
  return {
    terms_version: record.terms_version,
    privacy_version: record.privacy_version,
    terms_accepted: record.terms_accepted,
    privacy_accepted: record.privacy_accepted,
  };
}

async function fetchConsentStatus(): Promise<ConsentStatus> {
  const { data, error } = await supabase.rpc('get_legal_consent_status');
  if (error) throw error;
  return parseConsentStatus(data);
}

export function LegalConsentGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const checkConsent = useCallback(async (showLoading = true) => {
    if (showLoading) setState({ kind: 'loading' });
    setError(null);
    try {
      const status = await fetchConsentStatus();
      setState(status.terms_accepted && status.privacy_accepted
        ? { kind: 'accepted' }
        : { kind: 'required', termsVersion: status.terms_version, privacyVersion: status.privacy_version });
    } catch (checkError) {
      setState({ kind: 'error', message: checkError instanceof Error ? checkError.message : 'Unable to verify legal document acceptance.' });
    }
  }, []);

  useEffect(() => {
    void checkConsent();
    const refreshConsentWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkConsent(false);
    };
    window.addEventListener('focus', refreshConsentWhenVisible);
    document.addEventListener('visibilitychange', refreshConsentWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshConsentWhenVisible);
      document.removeEventListener('visibilitychange', refreshConsentWhenVisible);
    };
  }, [checkConsent]);
  useEffect(() => {
    if (state.kind === 'required') headingRef.current?.focus();
  }, [state.kind]);

  async function acceptDocuments() {
    if (state.kind !== 'required' || !termsChecked || !privacyChecked) return;
    setIsSaving(true);
    setError(null);
    try {
      const { data, error: acceptError } = await supabase.rpc('accept_current_legal_documents', {
        expected_terms_version: state.termsVersion,
        expected_privacy_version: state.privacyVersion,
      });
      if (acceptError) throw acceptError;
      const status = parseConsentStatus(data);
      if (!status.terms_accepted || !status.privacy_accepted) {
        throw new Error('The database did not confirm acceptance of the current document versions.');
      }
      setState({ kind: 'accepted' });
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Unable to save document acceptance. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function signOut() {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(signOutError.message);
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
    }
  }

  if (state.kind === 'accepted') return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="legal-consent-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="border-b border-slate-200 p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Required before continuing</p>
          <h1 id="legal-consent-title" ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-semibold text-brand-900">Review DroneSMS legal documents</h1>
          <p className="mt-2 text-sm text-slate-600">Review the Privacy Policy and Terms of Service. Acceptance is saved to your account with the current document versions.</p>
        </header>
        {state.kind === 'loading' ? <div className="p-6 text-sm text-slate-600" role="status">Checking your document acceptance…</div> : null}
        {state.kind === 'error' ? <div className="flex flex-wrap items-center gap-3 p-6"><p className="w-full text-sm text-red-700" role="alert">{state.message}</p><button type="button" className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void checkConsent()}>Retry</button><button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => void signOut()}>Sign out</button></div> : null}
        {state.kind === 'required' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Terms {state.termsVersion}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Privacy {state.privacyVersion}</span></div>
              <div className="space-y-8"><section><h2 className="mb-3 text-lg font-semibold text-brand-900">Privacy Policy</h2><LegalDocumentContent document="privacy" /></section><section className="border-t border-slate-200 pt-6"><h2 className="mb-3 text-lg font-semibold text-brand-900">Terms of Service</h2><LegalDocumentContent document="terms" /></section></div>
            </div>
            <footer className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 sm:p-6">
              <label className="flex items-start gap-3 text-sm text-slate-700"><input className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700" type="checkbox" checked={privacyChecked} onChange={(event) => setPrivacyChecked(event.target.checked)} disabled={isSaving} /><span>I have reviewed and acknowledge the Privacy Policy.</span></label>
              <label className="flex items-start gap-3 text-sm text-slate-700"><input className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-700" type="checkbox" checked={termsChecked} onChange={(event) => setTermsChecked(event.target.checked)} disabled={isSaving} /><span>I have read and agree to the Terms of Service.</span></label>
              {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
              <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center"><button type="button" className="min-h-11 self-start rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50" onClick={() => void signOut()} disabled={isSaving}>Sign out</button><div className="flex flex-col gap-2 sm:flex-row">{error ? <button type="button" className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white" onClick={() => { setTermsChecked(false); setPrivacyChecked(false); void checkConsent(); }}>Reload current documents</button> : null}<button type="button" className="min-h-11 rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:bg-slate-400" onClick={() => void acceptDocuments()} disabled={!termsChecked || !privacyChecked || isSaving}>{isSaving ? 'Saving acceptance…' : 'Accept and continue'}</button></div></div>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}
