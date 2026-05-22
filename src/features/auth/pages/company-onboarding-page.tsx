export function CompanyOnboardingPage() {
  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-semibold text-brand-900">Company Onboarding</h1>
      <p className="mt-2 text-sm text-slate-600">Complete profile/company setup placeholder before dashboard access.</p>
      <form className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Company Name
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="text" placeholder="Skyline Drone Ops" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          FAA Part 107 Number (Optional)
          <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="text" placeholder="Enter certificate number" />
        </label>
        <button type="button" className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white">Save & Continue</button>
      </form>
    </section>
  );
}
