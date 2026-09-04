DroneSMS MVP Technical Implementation Plan

> **Implementation status:** This is an early planning document, not a description of the
> current database or user workflow. Where this plan differs from the application, the
> application and Supabase migrations are authoritative. In particular, the implemented JHA
> uses guided hazard identification, documented controls, controls-in-place confirmation,
> Safety Manager review, RPIC acceptance, and Ready to Operate; operators do not assign
> numerical scores or Low/Medium/High operational risk ratings.

1) Recommended Architecture (MVP, scalable but simple)

Recommended stack:
- Frontend: React + TypeScript + Vite + Tailwind (mobile-first)
- Backend platform: Supabase (Postgres, Auth, Storage, RLS, Edge Functions)
- Payments: Stripe checkout + webhook sync
- PDF pipeline: server-generated PDF via HTML template + headless renderer
- Smart Site Intelligence orchestration: Supabase Edge Function that calls external APIs and writes normalized site intelligence data to the database

Architecture pattern:
- Thin client + service layer + database policies
- Keep complex business logic out of the UI
- Frontend handles forms and operational UX
- Edge functions handle external API calls, operational-condition warnings, and site intelligence refreshes
- Database enforces tenant security and data integrity

Why this architecture fits DroneSMS:
- Faster performance on tablets and phones
- Better reliability in field environments
- Easier future integrations
- Keeps the MVP maintainable and scalable

2) Frontend Structure (mobile-first + iPad Safari focused)

App shell:
- Sticky top bar
- Bottom navigation on smaller devices
- Large touch targets
- Single-column layouts on phones
- Responsive layouts for tablets and desktop
- Sync and save status indicators

Feature modules:
- auth/
- jobs/
- templates/
- site-intel/
- pdf/
- billing/
- admin/

State management:
- React Query for server data
- Lightweight local state for forms
- Auto-save debounce with visible save indicators

Field-focused UX:
- Editable auto-populated fields
- Never block typing during background lookups
- High-contrast aviation-style interface
- Minimal clutter
- Clear progress indicators

3) Supabase Database Setup

Core tables:
- organizations
- profiles
- jobs
- job_templates
- job_template_responses
- site_intel_snapshots
- site_intel_risks
- pdf_packets
- training_logs
- subscriptions
- audit_events

Jobs table additions:
- airspace_class
- laanc_required
- uasfm_altitude
- nearest_airport
- nearest_er
- weather_snapshot
- sunset_time
- tfr_flag
- site_coordinates
- site_intel_status
- site_intel_last_run_at
- site_intel_confidence

Security:
- Organization-based row-level security
- Users only access organization data
- Edge functions use service-role access
- Audit logging for critical actions

4) Routing Structure

Routes:
- /login
- /register
- /dashboard
- /jobs
- /jobs/new
- /jobs/:id/overview
- /jobs/:id/site-intel
- /jobs/:id/templates/:templateId
- /jobs/:id/review
- /jobs/:id/pdf
- /training
- /billing
- /admin

The /jobs/:id/site-intel page becomes the operational awareness center for the job.

5) API Integration Strategy

Integration pattern:
- All third-party API calls handled server-side
- Normalize responses into internal schema
- Cache results where possible
- Store timestamps and data source references

Suggested providers:
- Google Maps or Mapbox
- FAA airspace/UAS Facility Map data
- TFR/NOTAM sources
- Weather API
- Google Places API
- Future LAANC provider integrations

Reliability:
- Timeout handling
- Partial data fallback
- Cached snapshot retention
- Clear disclaimers that the platform does not provide authorization approval

6) Smart Site Intelligence Workflow

Workflow:
1. Operator creates job and enters address
2. Site intelligence refresh function runs
3. System:
   - geocodes address
   - fetches airspace data
   - determines likely LAANC requirement
   - identifies nearby airports
   - identifies nearest emergency room
   - fetches weather and wind
   - determines sunset/civil twilight
   - checks TFR/NOTAM warnings
4. Site-intelligence checks generate factual operational-condition warnings for operator review
5. Snapshot is saved
6. Operator reviews and edits information
7. Snapshot is linked to exported PDF packet

All auto-populated data remains editable by the operator.

7) PDF Export Strategy

Approach:
- HTML-based templates rendered server-side into PDFs
- Store PDFs in Supabase Storage
- Save immutable metadata records

Packet contents:
- Job details
- Completed templates
- Smart site intelligence summary
- Warnings and disclaimers
- Generated timestamps and version references

Why server-side rendering:
- More reliable on iPad Safari
- Consistent formatting
- Better professional output
- Easier long-term testing

8) Mobile Usability Strategy

Design philosophy:
- One-hand usability
- High-glare environment support
- Low cognitive load
- Fast completion workflows

iPad Safari considerations:
- Avoid hover-dependent UI
- Avoid fragile custom form controls
- Sticky action bars
- Reliable keyboard interactions

Form ergonomics:
- Segmented workflows
- Progress indicators
- Quick-pick chips
- Minimal scrolling

Connectivity resilience:
- Optimistic local edits
- Sync retry handling
- Visible connection/sync state

Accessibility:
- High contrast
- Large touch targets
- Clear typography
- Predictable layouts

9) Phased Build Order

Phase 0 — Foundation
- Repo setup
- Environment configuration
- Supabase connection
- Base design system
- Mobile shell

Phase 1 — Authentication + Onboarding
- Registration
- Login
- Profile setup
- Protected routes

Phase 2 — Jobs + Templates
- Job creation
- Template rendering
- Autosave
- Review states

Phase 3 — PDF Packet Pipeline
- Server-side PDF generation
- Storage
- Download/share workflows

Phase 4 — Smart Site Intelligence
- External API orchestration
- Site intelligence dashboard
- Operational-condition warnings
- Operator review workflow

Phase 5 — Training Logs
- CRUD operations
- Export integration

Phase 6 — Stripe Billing
- Plans
- Checkout
- Webhooks
- Entitlement checks

Phase 7 — Admin Tools
- Admin dashboards
- Template management
- Operational support views

10) Major Technical Risks

External aviation data inconsistency
Mitigation:
- Timestamps
- Source metadata
- Manual overrides
- Fallback states

Over-automation risk
Mitigation:
- Never imply FAA approval
- Use “Likely Required” language
- Require operator confirmation

iPad Safari quirks
Mitigation:
- Early device testing
- Avoid fragile CSS/JS behaviors
- Server-side PDF generation

Performance issues
Mitigation:
- Caching
- Lightweight bundles
- Background refreshes

Schema rigidity
Mitigation:
- Store normalized data plus raw snapshots
- Future-proof integration design

Security and tenant isolation
Mitigation:
- Row-level security
- Service-role restricted functions
- Audit logging

Suggested MVP Definition of Done

- Operator can authenticate and create jobs
- Templates work smoothly on phones and tablets
- Site intelligence auto-populates correctly
- Auto-populated data remains editable
- Warnings and disclaimers display clearly
- Professional PDF packets generate reliably
- Works smoothly on iPad Safari and mobile devices
- Architecture supports future smart integrations
