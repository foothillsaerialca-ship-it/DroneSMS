# DroneSMS user guide

This guide explains where to start in DroneSMS and the most efficient order to move through the
site, from first sign-in to an exported job packet. It describes the application as implemented
in version `0.1.0` (beta).

## The short version

Set up once, then repeat the job loop for every operation.

**One-time setup (about 30 minutes)**

1. Register and confirm your email.
2. Complete **Company Onboarding**.
3. Fill in **Settings → Organization** (identity, logo, credentials, proposal defaults).
4. Add your people in **Personnel**.
5. Add your aircraft and gear in **Equipment**.
6. Designate a Safety Manager in **SMS**.

**Every operation**

1. **Proposal** (optional) → generate the PDF → mark it Accepted → **Create Job**.
   Or skip straight to **Jobs → Create Job**.
2. Open the **Job File** and work it top to bottom:
   1. Crew Assignment
   2. Equipment Assignment
   3. JHA (plus Crew Briefing acknowledgments)
   4. Pre-Flight Checklist
   5. Ready to Operate
   6. Fly; log Safety Events if anything happens
   7. Operation Closeout
   8. Export Packet
3. The Safety Manager follows up on events and closeout reviews in **SMS**.

Use the **Dashboard** as your home base: its **Attention Required** list links straight to
whatever is blocking each job.

---

## 1. Getting in

| Step | Where | What to do |
| --- | --- | --- |
| Welcome | `/` | Read the beta notice and select **Proceed to Sign In**. |
| Register | **Operator Registration** (`/register`) | Enter your first and last name, email, and a password that meets the on-screen rules. |
| Confirm | Your inbox | Open the confirmation link. It returns you to DroneSMS and signs you in. |
| Sign in | **Pilot Login** (`/login`) | Use **Forgot Password?** if needed (the reset link is emailed to you), or **Resend verification email** if the confirmation never arrived. |

Signed-in users who open the welcome page are sent straight to the Dashboard.

## 2. One-time organization setup

Do these in order. Later screens pull data from earlier ones, so skipping ahead creates gaps you
have to come back and fill.

### 2.1 Company Onboarding

Until onboarding is finished, every page sends you to **Company Onboarding**. Only **Company name** is
required. Onboarding creates your organization, and you're its owner. Personnel, equipment,
proposals and jobs all belong to it.

### 2.2 Settings → Organization

Open **Settings** in the left navigation. Everything here is reused in proposal PDFs, job-file
headers and exported packets, so complete it before you create your first proposal.

- **Identity:** company name, primary contact, email, phone, address, website, logo.
- **Company credentials:** Licensed / Bonded / Insured, plus credential details.
- **Primary Service Type:** sets the default service type and scope for new proposals.
- **Proposal content:** company statement, service commitment, default payment terms.
- **Proposal Inclusion Controls:** choose which of these sections appear on proposal PDFs.

Password and email changes are under **Settings → Account Settings**.

### 2.3 Personnel

Add everyone who may fly or support an operation.

- **Role:** Remote Pilot in Command, Visual Observer, Crew Member, Payload Operator or Safety
  Manager. **Status:** Active, Training or Inactive. Only **Active** people can be assigned to
  jobs or designated Safety Manager.
- Enter certificate and training expiration dates. Each card shows a readiness badge
  (**Pilot Ready**, **Cert Missing**, **Cert Expired**, **Training Due Soon**,
  **Training Expired**). Fix these before you assign the person.
- **Add an email address for every non-RPIC crew member.** Electronic crew-briefing
  acknowledgments are sent there. Without one, the RPIC has to record a manual field briefing.

> **Sign-off accounts.** Safety Manager Review and RPIC Acceptance in the JHA can only be
> completed by the signed-in DroneSMS user linked to that personnel record. Today, a personnel
> record is linked to the account that created it.

### 2.4 Equipment

Add aircraft and supporting equipment: drones, controllers, batteries, payloads, chargers,
safety kits, chemical/material products and so on.

- Set **Status** (Available, In Use, Maintenance, Inactive, Retired) and maintenance dates.
  Badges show **Ready**, **Due Soon**, **Overdue**, **Maintenance** or **Retired**.
- For **Chemical / Material** items, fill in the chemical details and attach reference documents
  such as the SDS. They carry into proposals, JHAs and packets.

### 2.5 SMS → Safety Manager Configuration

Open **SMS** and choose an active person as **Safety Manager**. Only the organization owner can
change this.

**This step is required.** A JHA can't receive Safety Manager Review until a Safety Manager is
designated, so no job can reach Ready to Operate without it.

The **Safety Policy & Objectives** language (stop-work authority, hazard reporting, emergency
procedures) is also owner-edited and appears in crew briefings.

---

## 3. The operation workflow

### 3.1 Proposal (optional): Proposals → Create Proposal

Use a proposal when a client needs a quote first. If the work is already agreed, skip to
**3.2**.

1. Enter the client, contact, site address, and **Service Type**. Scope, deliverables and
   exclusions default from Settings; edit them as needed.
2. Add the price, payment terms, estimated duration and **Proposal Valid Until Date**.
3. Record the preliminary **airspace** findings: classification, LAANC, nearby airports or
   heliports, and restrictions/TFRs.
4. Choose the **Proposed Crew** and **Proposal Equipment**.
5. Use the **Hazard Library** to select preliminary hazards, or add a custom hazard.
6. Save. Then, on the **Proposals** list:
   - **Generate Proposal PDF** downloads the PDF and saves a copy to DroneSMS records.
   - Move **Proposal status** through Draft → Sent → Under Review → Accepted / Declined.
   - **Create Job** converts the proposal. Client, site, service, airspace, crew, equipment and
     hazards are copied into the new job, and the proposal is marked **Converted to Job**. Each
     proposal can be converted only once.

### 3.2 Job: Jobs → Create Job

Use this when there is no proposal. Enter the job name, client/property owner, service type,
site address, location and planned date. New jobs start as **Planned**.

The **Job Detail** page (`/jobs/:id`) holds these core fields and the job status (Planned,
In Progress, Needs Review, Complete). The operational work happens in the **Job File**.

### 3.3 Job File: work it top to bottom

Open the job's **Job File** (`/jobs/:id/hub`). It says it on the page: *plan, verify, execute,
close out, then export.* The sections are numbered in the order you should complete them.

| # | Section | What to do | Done when |
| --- | --- | --- | --- |
| 1 | **Crew Assignment** | **Add Crew** and assign an **RPIC**. Other roles: Pilot, Visual Observer, Payload Operator, Ground Crew. Check each person's readiness badge. | An active RPIC is assigned |
| 2 | **Equipment Assignment** | Add the aircraft and supporting equipment. Avoid items marked Maintenance, Overdue or Retired. | Equipment is assigned |
| 3 | **Job Hazard Analysis (JHA)** | **Open JHA** and complete all six steps (see 3.4). | Status shows **Complete** |
| — | **Crew Briefing / Crew Acknowledgment** | After the RPIC gives the in-person briefing, **Send Crew Acknowledgments**. Each non-RPIC crew member reviews and acknowledges the briefing from an email link. If email isn't possible, the RPIC uses **Record Manual Field Briefing** and gives a reason. Solo operations skip this. | Every non-RPIC crew member is acknowledged |
| 4 | **Pre-Flight Checklist** | **Open Pre-Flight** and mark each item **Confirmed** or **Not Applicable** (see 3.5). | **Pre-flight complete** |
| 5 | **Ready to Operate** | The assigned RPIC checks both statements (controls in place and fitness for duty), then selects **Approve Ready to Operate**. Any remaining blockers are listed under **Before approval**. | Status shows **Ready to Operate** |
| 6 | **Operation Execution / Safety Events** | Fly under the approved controls. **Add Safety Event** for near misses, unexpected hazards or deviations: category, outcome, description, and immediate actions taken. | — |
| 7 | **Operation Closeout** | Choose the **Operation Result**. Add a narrative (required unless *Completed as Planned*) and answer **Post-operation Safety Assurance**: were the controls effective? Then **Save Operation Closeout**. | Closeout **Complete** |
| 8 | **Export Packet** | **Export Packet** builds a single PDF: proposal, job info, crew, equipment, JHA, airspace review, pre-flight, safety events and closeout. It's retained in DroneSMS records. | PDF downloaded |

**Ready to Operate is blocked until all of these are true:**

- The JHA is complete.
- Safety Manager Review and RPIC Acceptance are both current.
- Controls are confirmed in place.
- The pre-flight checklist is complete.
- An active RPIC is assigned, and the RPIC has confirmed fitness for duty.
- Every non-RPIC crew member is acknowledged.
- Any required public right-of-way permit is **Approved**.

If the JHA, crew or pre-flight changes after approval, the status changes to
**Approval Stale**. Re-review and approve again.

### 3.4 JHA: the six steps

The progress bar across the top lets you jump between steps. **Next**, **Back** and **Save
Progress** all save your work, so you can leave and return at any time.

1. **Mission Basics:** JHA number, date, site address, job type/scope.
2. **Site Conditions:** ground and work surfaces, wind, weather, visibility, and access
   constraints. Also covers public presence and the exclusion zone. If the exclusion zone
   restricts a public sidewalk or street, record whether a permit is required and its status.
   DroneSMS records your determination; it does not decide whether a permit is legally
   required.
3. **Airspace:** FAA class, LAANC, nearby airport/heliport, other authorizations,
   restrictions/TFRs. Keep LAANC authorization documentation in the job file before flying.
4. **Environmental:** only when it applies. Covers runoff, water-body proximity, applied
   chemicals (SDS/HazCom), containment and reclamation, and regulatory citations. These fields
   appear automatically for service types that use liquids or applied materials.
5. **Hazards:** add hazards from the library suggestions or as custom entries. Give each one a
   mitigation and a **Control Owner**, and attach **photo evidence** showing the control is in
   place. Only hazards you add become part of the JHA.
6. **Crew Briefing & Communications:** PPE, communication methods, crew briefed, controls in
   place, stop-work authority acknowledged. Then come two separate sign-offs:
   - **Safety Manager Review** by the designated Safety Manager.
   - **RPIC Acceptance** by the assigned RPIC.

   If one person holds both roles, they still complete both. Finish with **Save JHA**.

> DroneSMS does not use severity/likelihood scores or Low/Medium/High risk ratings. Safety comes
> from identifying hazards, documenting controls, confirming they're in place, and role-based
> sign-off.

### 3.5 Pre-Flight Checklist

There are three sections:

- **Aircraft & Equipment:** aircraft selected, batteries, propellers, firmware, GPS, home point,
  storage.
- **Environment & Airspace:** weather, wind, airspace, LAANC if required, NOTAM/TFR.
- **Crew & Safety:** visual observer if needed, emergency procedures, crew communications,
  **RPIC preflight review**.

Every item must be resolved. **RPIC preflight review** must be **Confirmed**; it can't be marked
Not Applicable.

---

## 4. Safety Manager follow-up (SMS)

The **SMS** page is where the safety loop closes after operations.

- **Safety Manager Review:** each saved Safety Event creates a review. Record whether the hazard
  was already known, whether an existing control was meant to prevent it, and what happened
  with that control. Then choose one: **No organizational change needed**, **Add corrective
  action only**, **Continue investigation**, or **Start change review**.
- **Control-effectiveness reviews:** closeouts that answered *Partially* or *No* to "Were the
  safety controls effective?" show up here for review. Filter by date, job or result.
- **Management of Change (MOC):** **Start Change Review** for any change to equipment,
  procedures, personnel or capability. Each review moves through actions, **Approve for
  Operational Use** (or **Return for changes**), and then follow-up and closure. **Export MOC
  register (Excel)** produces an audit copy.

---

## 5. Working efficiently

- **Start every session on the Dashboard.** **Current Operation** shows the job's workflow stage:
  Crew Assignment → Equipment Assignment → JHA In Progress → Ready → In Progress → Awaiting
  Closeout. **Continue Operation** takes you straight into its Job File.
- **Clear Attention Required from the top.** Each item (crew missing, equipment missing, JHA not
  completed, closeout required, proposal awaiting review) links to the exact place to fix it.
- **Keep the master data current.** Personnel credentials, equipment maintenance and Settings
  feed every proposal, JHA and packet. Updating them once beats correcting each job.
- **Prefer Proposal → Create Job.** Converting carries client, site, airspace, crew, equipment
  and hazards forward, so you don't re-enter them.
- **Do planning before site day.** Crew, equipment, JHA steps 1–5 and crew acknowledgments can
  all be done in the office. On site, only re-check conditions, run the pre-flight, and approve
  Ready to Operate.
- **Close out the same day.** The packet can't be exported until closeout is saved, and the
  details are freshest right after the flight.

## 6. Known beta limitations

- **Reports** is a placeholder ("coming soon").
- Some **Account Settings** cards are placeholders.
- Billing, multi-company accounts, admin tools and offline use are planned, not available.
- Report anything that looks wrong. DroneSMS is in beta and your feedback guides fixes.

## Quick reference: where things live

| I want to… | Go to |
| --- | --- |
| See what needs attention | Dashboard |
| Quote a client | Proposals → Create Proposal |
| Start an operation | Jobs → Create Job, or **Create Job** on an accepted proposal |
| Assign crew/equipment, run the operation | Job → Job File |
| Do the hazard analysis | Job File → Open JHA |
| Run the pre-flight | Job File → Open Pre-Flight |
| Get the final PDF | Job File → Export Packet (after closeout) |
| Add/update people or aircraft | Personnel / Equipment |
| Change company info or proposal defaults | Settings → Organization |
| Change password or email | Settings → Account Settings |
| Designate Safety Manager, review events, MOC | SMS |
