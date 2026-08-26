/**
 * File purpose: Provides the reusable organization identity card React component and its local interaction behavior.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import {
  displayOrganizationValue,
  getOrganizationLogoUrl,
  type OrganizationSettings
} from '@frontend/features/settings/lib/organization-settings';

/**
 * Purpose: Defines the input contract accepted by the organization identity card component.
 * Fallback/error behavior: This declaration is compile-time only; nullable and optional fields are handled by the owning loader, normalizer, or UI fallback.
 * Known limitation: TypeScript does not generate runtime validation from this declaration, so untrusted service data still requires explicit normalization.
 */
type OrganizationIdentityCardProps = {
  organization: OrganizationSettings | null;
  title?: string;
  description?: string;
  isLoading?: boolean;
};

/**
 * Renders the organization identity card interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
export function OrganizationIdentityCard({
  organization,
  title = 'Company Information',
  description = 'Loaded from Settings / Organization.',
  isLoading = false
}: OrganizationIdentityCardProps) {
  const logoUrl = getOrganizationLogoUrl(organization);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {logoUrl ? (
          <img className="h-16 w-16 rounded-lg border border-slate-200 object-contain" src={logoUrl} alt="Company logo" />
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-600">Loading company information from Settings...</p>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <IdentityField label="Company Name" value={organization?.companyName ?? ''} />
          <IdentityField label="Phone" value={organization?.phone ?? ''} />
          <IdentityField label="Email" value={organization?.email ?? ''} />
          <IdentityField label="Address" value={organization?.address ?? ''} />
          <IdentityField label="Primary Contact" value={organization?.primaryContact ?? ''} />
          <IdentityField label="Company Statement" value={organization?.companyStatement ?? ''} />
        </dl>
      )}
    </section>
  );
}

/**
 * Renders the identity field interface and coordinates its user interactions.
 * Fallback/error behavior: Loading, empty, validation, and service-error states are delegated to the component UI and its page-level handlers.
 */
function IdentityField({ label, value }: { label: string; value: string }) {
  const isMissing = !value.trim();

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 whitespace-pre-wrap text-sm ${isMissing ? 'text-slate-400' : 'text-slate-800'}`}>
        {displayOrganizationValue(value)}
      </dd>
    </div>
  );
}
