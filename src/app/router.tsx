/**
 * File purpose: Defines public and protected application routes and the landing-page entry experience.
 * Fallback/error behavior: optional data uses module-defined defaults; service and browser failures are surfaced to callers or page error state.
 * Known issues: see docs/documentation.md for audit findings that affect this module or its verification path.
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./frontend/shell";
import { ProtectedRoute } from "./frontend/features/auth/components/protected-route";
import { PublicAuthLayout } from "./frontend/features/auth/components/public-auth-layout";
import { PageFooterLayout } from "./frontend/components/page-footer-layout";
import { featureFlags } from "./frontend/lib/feature-flags";

const DashboardPage = lazy(() =>
  import("./frontend/features/dashboard/pages/dashboard-page").then(
    (module) => ({ default: module.DashboardPage }),
  ),
);
const JobsPage = lazy(() =>
  import("./frontend/features/jobs/pages/jobs-page").then((module) => ({
    default: module.JobsPage,
  })),
);
const NewJobPage = lazy(() =>
  import("./frontend/features/jobs/pages/new-job-page").then((module) => ({
    default: module.NewJobPage,
  })),
);
const NewProposalPage = lazy(() =>
  import("./frontend/features/jobs/pages/new-proposal-page").then((module) => ({
    default: module.NewProposalPage,
  })),
);
const JobDetailPage = lazy(() =>
  import("./frontend/features/jobs/pages/job-detail-page").then((module) => ({
    default: module.JobDetailPage,
  })),
);
const JobFileHubPage = lazy(() =>
  import("./frontend/features/jobs/pages/job-file-hub-page").then((module) => ({
    default: module.JobFileHubPage,
  })),
);
const JobHazardAnalysisPage = lazy(() =>
  import("./frontend/features/jobs/pages/job-hazard-analysis-page").then(
    (module) => ({ default: module.JobHazardAnalysisPage }),
  ),
);
const PreflightChecklistPage = lazy(() =>
  import("./frontend/features/preflight/pages/preflight-checklist-page").then(
    (module) => ({ default: module.PreflightChecklistPage }),
  ),
);
const PersonnelPage = lazy(() =>
  import("./frontend/features/personnel/pages/personnel-page").then(
    (module) => ({ default: module.PersonnelPage }),
  ),
);
const EquipmentPage = lazy(() =>
  import("./frontend/features/equipment/pages/equipment-page").then(
    (module) => ({ default: module.EquipmentPage }),
  ),
);
const BetaWelcomePage = lazy(() =>
  import("./frontend/features/auth/pages/beta-welcome-page").then((module) => ({
    default: module.BetaWelcomePage,
  })),
);
const RegisterPage = lazy(() =>
  import("./frontend/features/auth/pages/register-page").then((module) => ({
    default: module.RegisterPage,
  })),
);
const CompanyOnboardingPage = lazy(() =>
  import("./frontend/features/auth/pages/company-onboarding-page").then(
    (module) => ({ default: module.CompanyOnboardingPage }),
  ),
);
const SettingsPage = lazy(() =>
  import("./frontend/features/settings/pages/settings-page").then((module) => ({
    default: module.SettingsPage,
  })),
);
const AccountSettingsPage = lazy(() =>
  import("./frontend/features/settings/pages/account-settings-page").then(
    (module) => ({ default: module.AccountSettingsPage }),
  ),
);
const SmsPage = lazy(() =>
  import("./frontend/features/sms/pages/sms-page").then((module) => ({
    default: module.SmsPage,
  })),
);
const MocRegisterPage = lazy(() =>
  import("./frontend/features/sms/pages/moc-register-page").then((module) => ({
    default: module.MocRegisterPage,
  })),
);
const MocDetailPage = lazy(() =>
  import("./frontend/features/sms/pages/moc-detail-page").then((module) => ({
    default: module.MocDetailPage,
  })),
);
const ReportsPage = lazy(() =>
  import("./frontend/features/reports/pages/reports-page").then((module) => ({
    default: module.ReportsPage,
  })),
);
const AboutPage = lazy(() =>
  import("./frontend/features/information/team").then((module) => ({
    default: module.AboutPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("./frontend/features/auth/pages/forgot-password-page").then(
    (module) => ({ default: module.ForgotPasswordPage }),
  ),
);
const ResetPasswordPage = lazy(() =>
  import("./frontend/features/auth/pages/reset-password-page").then(
    (module) => ({ default: module.ResetPasswordPage }),
  ),
);
const AuthCallbackPage = lazy(() =>
  import("./frontend/features/auth/pages/auth-callback-page").then(
    (module) => ({ default: module.AuthCallbackPage }),
  ),
);
const CrewBriefingAcknowledgmentPage = lazy(() =>
  import("./frontend/features/jobs/pages/crew-briefing-acknowledgment-page").then(
    (module) => ({ default: module.CrewBriefingAcknowledgmentPage }),
  ),
);
const AcceptOrganizationInvitationPage = lazy(() =>
  import("./frontend/features/auth/pages/accept-organization-invitation-page").then(
    (module) => ({ default: module.AcceptOrganizationInvitationPage }),
  ),
);
const OrganizationMembersPage = lazy(() =>
  import("./frontend/features/settings/pages/organization-members-page").then(
    (module) => ({ default: module.OrganizationMembersPage }),
  ),
);

/**
 * Implements app router for this module.
 * Fallback/error behavior: Invalid state is handled by the surrounding validation/error path; unexpected failures propagate to the caller.
 */
export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center p-6 text-sm text-slate-600">
          Loading DroneSMS…
        </div>
      }
    >
      <Routes>
        <Route element={<PublicAuthLayout />}>
          <Route index element={<BetaWelcomePage />} />
          <Route path="/login" element={<BetaWelcomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>
        <Route element={<PageFooterLayout />}>
          <Route
            path="/crew-briefing/acknowledge"
            element={<CrewBriefingAcknowledgmentPage />}
          />
          <Route
            path="/accept-invitation"
            element={<AcceptOrganizationInvitationPage />}
          />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route
              path="/onboarding/company"
              element={<CompanyOnboardingPage />}
            />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/proposals" element={<JobsPage mode="proposals" />} />
            <Route path="/jobs/new" element={<NewJobPage />} />
            <Route path="/proposals/new" element={<NewProposalPage />} />
            <Route
              path="/proposals/:proposalId/edit"
              element={<NewProposalPage />}
            />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/jobs/:jobId/hub" element={<JobFileHubPage />} />
            <Route
              path="/jobs/:jobId/templates/jha"
              element={<JobHazardAnalysisPage />}
            />
            <Route
              path="/jobs/:jobId/templates/preflight"
              element={<PreflightChecklistPage />}
            />
            <Route path="/personnel" element={<PersonnelPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            {featureFlags.reports ? (
              <Route path="/reports" element={<ReportsPage />} />
            ) : null}
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/settings"
              element={<Navigate to="/settings/organization" replace />}
            />
            <Route path="/settings/account" element={<AccountSettingsPage />} />
            <Route path="/settings/organization" element={<SettingsPage />} />
            <Route
              path="/settings/members"
              element={<OrganizationMembersPage />}
            />
            <Route path="/sms" element={<SmsPage />} />
            <Route path="/sms/moc" element={<MocRegisterPage />} />
            <Route path="/sms/moc/:mocId" element={<MocDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
