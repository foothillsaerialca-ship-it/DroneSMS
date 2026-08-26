/**
 * Renders the reports interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function ReportsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Reports</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-brand-900">Reports module coming soon.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
        This space is reserved for Proposal PDFs, Mission Packages, Completion Reports, and Safety Reports.
      </p>
    </section>
  );
}
