# DroneSMS user guide

This guide explains where to start in DroneSMS and how to move through the site efficiently,
from first sign-in to an exported job packet. Each section says what to do, which screen it
happens on, who has to be signed in, and what can make you redo work. It describes version
`0.1.0` (beta).

**Contents**

1. [The short version](#1-the-short-version)
2. [Who does what](#2-who-does-what)
3. [Getting in](#3-getting-in)
4. [One-time organization setup](#4-one-time-organization-setup)
5. [The operation workflow](#5-the-operation-workflow)
6. [Crew briefing and acknowledgment](#6-crew-briefing-and-acknowledgment)
7. [The JHA in detail](#7-the-jha-in-detail)
8. [Pre-flight, Ready to Operate, and flying](#8-pre-flight-ready-to-operate-and-flying)
9. [Closeout and packet export](#9-closeout-and-packet-export)
10. [What resets what](#10-what-resets-what)
11. [Safety Manager follow-up (SMS)](#11-safety-manager-follow-up-sms)
12. [Working efficiently](#12-working-efficiently)
13. [Troubleshooting blocker messages](#13-troubleshooting-blocker-messages)
14. [Known beta limitations](#14-known-beta-limitations)
15. [Quick reference](#15-quick-reference)

---

## 1. The short version

**Set up once:**

1. Register.
2. Company Onboarding.
3. Settings → Organization.
4. Personnel.
5. Equipment.
6. SMS → Safety Manager.

**For every operation:**

1. **Proposal**, then **Create Job**. Or create the job directly.
2. In the job's **Job File**, work these sections in order:
   1. Crew Assignment
   2. Equipment Assignment
   3. JHA
   4. Crew Briefing
   5. Pre-Flight
   6. Ready to Operate
   7. Fly and log Safety Events
   8. Closeout
   9. Export Packet
3. The Safety Manager follows up in **SMS**.

**The Dashboard is your home base.** Its **Attention Required** list links straight to whatever
is blocking each job.

---

## 2. Who does what

DroneSMS separates the safety roles. Some actions are only available to a specific person while
they're signed in; for anyone else, the button is disabled.

| Action | Who must be signed in |
| --- | --- |
| Change the Safety Manager designation and the SMS program language | Organization owner (the account that completed onboarding) |
| JHA **Safety Manager Review** | The designated Safety Manager |
| JHA **RPIC Acceptance** | The RPIC assigned to the job |
| Send crew acknowledgment emails, or record a manual field briefing | The RPIC assigned to the job |
| **Approve Ready to Operate** (including fitness for duty) | The RPIC assigned to the job |
| Acknowledge a crew briefing electronically | The crew member, from the emailed link. **No DroneSMS account is needed.** |
| Everything else: proposals, jobs, assignments, pre-flight, events, closeout, export | Any user in the organization |

> **Which account counts as "the RPIC" or "the Safety Manager"?** Each personnel record is
> linked to a DroneSMS user account. Today, that's the account that created the record. In a
> one-account company, the owner's account can act as both Safety Manager and RPIC. Both
> sign-offs are still recorded separately, and the person must still complete each one.

---

## 3. Getting in

| Step | Screen | What to do |
| --- | --- | --- |
| 1 | Welcome (`/`) | Read the beta notice and select **Proceed to Sign In**. |
| 2 | **Operator Registration** (`/register`) | Enter your first name, last name, email and password. The password must meet the rules shown on screen. |
| 3 | Your inbox | Open the confirmation link. It returns you to DroneSMS signed in. |
| 4 | **Pilot Login** (`/login`) | Sign in on later visits. **Forgot Password?** emails you a reset link. **Resend verification email** helps if the confirmation never arrived. |

---

## 4. One-time organization setup

Do these steps in order. Later screens pull data from earlier ones, and doing them out of order
leaves gaps you have to come back and fill.

### 4.1 Company Onboarding

Until onboarding is finished, every page redirects to **Company Onboarding**.

- Only **Company name** is required.
- Completing onboarding creates your organization and makes you its **owner**.

### 4.2 Settings → Organization

This information is reused on proposal PDFs, Job File headers and exported packets. Complete it
before your first proposal.

| Area | Fields | Where it shows up |
| --- | --- | --- |
| Identity | Company Name, Primary Contact, Email Address, Phone Number, Physical Address, Website, logo | Every PDF header, and the Job File's company card |
| Credentials | Licensed / Bonded / Insured, Company Credentials | Proposals, if included |
| Defaults | **Primary Service Type**, Default Payment Terms | Pre-fills new proposals (service type, scope, terms) |
| Proposal language | Company Statement, Service Commitment | Proposals, if included |
| Proposal Inclusion Controls | Include Company Credentials / Payment Terms / Service Commitment / Materials Used | Turns each section on or off in proposal PDFs |

Password and email changes are under **Settings → Account Settings**.

### 4.3 Personnel

Add everyone who may fly, observe or support an operation.

| Field | Notes |
| --- | --- |
| Full name, Phone | Required basics. |
| **Email** | **Optional for non-RPIC crew.** It's only used to send an electronic briefing acknowledgment. Crew members without an email are briefed through the manual field briefing (see [section 6](#6-crew-briefing-and-acknowledgment)). |
| Role | Remote Pilot in Command, Visual Observer, Crew Member, Payload Operator or Safety Manager. This is the person's default role; you choose their role per job when you assign them. |
| Status | **Active**, Training or Inactive. Only **Active** people can be designated Safety Manager. Inactive crew don't count toward briefing requirements. |
| Part 107 certificate number and expiration date | **Required for anyone who will act as RPIC.** If it's missing, the person shows **Cert Missing**. |
| Training expiration date | Drives the **Training Due Soon** and **Training Expired** badges. |
| Emergency contact name and phone | Kept on the record for emergencies. |
| Certifications Summary, Professional Bio, Profile Photo URL | Client-facing details used on proposals. |

**Readiness badges:**

| Badge | Meaning |
| --- | --- |
| **Pilot Ready** | Part 107 is current. |
| **Crew Ready** | Non-RPIC crew member with no training issues. |
| **Renew Soon** | Part 107 expires within 60 days. |
| **Cert Missing** | No Part 107 expiration date is recorded. |
| **Cert Expired** | Part 107 has expired. Don't assign this person as RPIC. |
| **Training Due Soon** / **Training Expired** | Training expiration is coming up, or has passed. |

### 4.4 Equipment

Add the aircraft and the supporting gear you take to jobs.

- **Type:** Drone, Controller, Battery, Payload, Ground Support, Filtration / Water System,
  Camera / Sensor, Charger, Safety Kit, Chemical / Material, or Other.
- **Details:** equipment name, make, model, serial number, FAA registration, assigned location,
  **Maintenance due** date, and notes.
- **Status:** Available, In Use, Maintenance, Inactive or Retired. **Retired** items can't be
  assigned to jobs.
- **Badges:** Ready, Due Soon, Overdue, Maintenance or Retired, based on status and maintenance
  date.
- **Chemical / Material items:** product category is required. Attach **Reference Documents**
  such as the Safety Data Sheet (SDS), Technical Data Sheet (TDS) or Product Label. They carry
  into the JHA and the packet.
- **"Does this equipment introduce a new operational capability?"** This is asked when you add
  an item. Answering **Yes** automatically starts a **Management of Change** review in SMS.
  Choose **Review now** to open it, or **Review later**.

### 4.5 SMS → Safety Manager Configuration

Open **SMS** and choose an **active** person as **Safety Manager**. Only the organization owner
can make this change.

**Do this before your first JHA.** Without a Safety Manager, the JHA shows *"Safety Manager not
designated"*. Safety Manager Review can't be completed, so no job can reach Ready to Operate.

The owner also maintains **Safety Policy & Objectives** here: stop-work authority, hazard
reporting, and the emergency procedures summary. This language appears in crew briefings.

---

## 5. The operation workflow

### 5.1 Proposal (optional)

Go to **Proposals → Create Proposal**. Use a proposal when a client needs a quote first. If the
work is already agreed, skip to **5.2**.

1. **Client and site:** proposal name, client name, contact name, phone, email, site address.
2. **Service:** choose the **Service Type**. Description, deliverables and exclusions pre-fill
   from Settings; edit them for this job.
3. **Commercial terms:** proposal amount, payment terms, estimated duration, and **Proposal Valid
   Until Date**.
4. **Preliminary airspace:** airspace classification, LAANC required, relevant airport or
   heliport, additional authorization required, known restrictions/TFRs.
5. **Proposed Crew:** pick people and a proposed role for each. Their qualifications show
   read-only.
6. **Proposal Equipment:** search and select equipment.
7. **Preliminary hazards:** pick from the **Hazard Library** (filtered by service type), or add a
   **Custom Hazard** with a default mitigation.
8. Save.

Then, from the **Proposals** list:

- **Generate Proposal PDF** downloads the PDF and saves a copy to DroneSMS records.
- Track **Proposal status**: Draft → Sent → Under Review → Accepted or Declined. Proposals in
  Draft/Sent/Under Review appear on the Dashboard as *Proposal awaiting review*.
- **Create Job** converts the proposal. It copies the client, site, service, airspace, crew,
  equipment and hazards into a new job. The proposal is marked **Converted to Job**, with a
  link to the job. Each proposal can be converted **only once**.

### 5.2 Job

Go to **Jobs → Create Job** when there's no proposal. Enter:

- job name
- client/property owner
- service type
- site address and location
- planned date
- notes

New jobs start as **Planned**.

The **Job Detail** page holds these core fields, a link back to the source proposal, and the job
**Status** (Planned, In Progress, Needs Review, Complete).

> Changing the job's **location, planned date or service type** changes the operation the crew
> was briefed on. Any crew acknowledgments must be redone, and a Ready to Operate approval
> becomes stale (see [section 10](#10-what-resets-what)). Lock these down before briefing.
> Renaming the job is safe at any time.

### 5.3 The Job File

All operational work happens in the job's **Job File** (`/jobs/:id/hub`). The page tells you to
*plan, verify, execute, close out, then export*. The numbered sections are in the order to
complete them:

| # | Section | Detail |
| --- | --- | --- |
| 1 | Crew Assignment | 5.4 |
| 2 | Equipment Assignment | 5.5 |
| 3 | Job Hazard Analysis (JHA) | [Section 7](#7-the-jha-in-detail) |
| — | Crew Briefing / Crew Acknowledgment | [Section 6](#6-crew-briefing-and-acknowledgment) |
| 4 | Pre-Flight Checklist | [Section 8](#8-pre-flight-ready-to-operate-and-flying) |
| 5 | Ready to Operate | [Section 8](#8-pre-flight-ready-to-operate-and-flying) |
| 6 | Operation Execution / Safety Events | [Section 8](#8-pre-flight-ready-to-operate-and-flying) |
| 7 | Operation Closeout | [Section 9](#9-closeout-and-packet-export) |
| 8 | Export Packet | [Section 9](#9-closeout-and-packet-export) |

### 5.4 Crew Assignment

1. Select **Add Crew**, choose the person, then choose their **Assigned role** for this job:
   - **RPIC**
   - **Pilot**
   - **Visual Observer**
   - **Payload Operator**
   - **Ground Crew**
2. Assign an **RPIC**. They must have a current Part 107, so check the badge.
3. Add every other crew member. Use **Edit Role** to change a role later.

**Finalize the crew before the briefing.** Adding, removing or re-roling anyone changes the
briefing. Acknowledgments must be redone, and any approval goes stale.

### 5.5 Equipment Assignment

Select **Add Equipment** and assign each aircraft and supporting item (batteries, controllers,
payloads, safety kit, chemicals). Avoid items showing Maintenance, Overdue or Retired.

Changing equipment after approval makes the approval stale.

---

## 6. Crew briefing and acknowledgment

The RPIC gives every operation's crew a **full in-person briefing**. DroneSMS then records
evidence that each **non-RPIC operational crew member** participated. That means each Pilot,
Visual Observer, Payload Operator and Ground Crew member who isn't Inactive.

**Email is optional.** You can record a crew member's participation in either of two ways, and
both count fully toward Ready to Operate:

| Path | When to use it | Email needed? |
| --- | --- | --- |
| **A. Electronic acknowledgment** | The crew member has an email address and can open it | Yes, for that crew member |
| **B. Manual Field Briefing** | No email on file, no signal on site, device problems, or any other reason | **No** |
| **C. Solo operation** | Only the RPIC is assigned | Nothing to record |

You can mix paths: some crew members acknowledge electronically and others are recorded
manually.

### Before you start (all paths)

- The **JHA must be saved** at least once. The briefing content comes from it.
- The **assigned RPIC must be signed in.** Only they can send requests or record manual
  briefings.
- The crew and JHA content should be final. If either changes later, every acknowledgment is
  marked **Stale** and has to be redone.

### Path A: Electronic acknowledgment

1. The RPIC gives the in-person briefing.
2. In the Job File, the RPIC either selects **Send Crew Acknowledgments** (everyone) or **Send**
   on one crew member's row. **Resend** issues a fresh link and cancels the old one.
3. Each crew member receives an email and opens the secure link. **They don't need a DroneSMS
   account.** The page shows the full briefing:
   - operation scope
   - crew and roles
   - hazards and controls
   - PPE
   - communications
   - emergency planning
   - site constraints
4. The crew member checks that they reviewed the briefing, types their full name, and submits.
5. Their row changes from **Sent** to **Acknowledged**.

Links expire after **7 days**. If the briefing changes before they acknowledge, the link stops
working ("The briefing has changed"), and the RPIC sends a new one. If sending fails, check the
email address on the Personnel record and send again.

### Path B: Manual Field Briefing (no email needed)

1. The RPIC gives the in-person briefing.
2. On the crew member's row, the RPIC selects **Record Manual Field Briefing**.
3. The RPIC picks the reason electronic acknowledgment isn't being used:
   - No internet/cellular service
   - Crew member unable to access email
   - Device/access issue
   - Other (type a short explanation)
4. The RPIC selects **Record Manual Briefing**. This confirms the crew member took part in the
   full briefing and could ask questions.
5. The row shows **Manual Field Briefing Recorded**, with the reason, who recorded it, and when.

A crew member with no email on file sees the note *"Add an email on the Personnel record to use
electronic acknowledgment."* That's informational only. **Record Manual Field Briefing** is
still available.

### Path C: Solo operation

If only an RPIC is assigned, the section shows *"Solo operation — no separate crew acknowledgment
is required."* The RPIC continues with JHA RPIC Acceptance and Ready to Operate.

### Row statuses

| Status | Meaning |
| --- | --- |
| **Not Sent** | Nothing recorded yet for the current briefing. |
| **Sent** | Email delivered; waiting for the crew member. |
| **Acknowledged** | Done. Electronic acknowledgment. |
| **Manual Field Briefing Recorded** | Done. Recorded by the RPIC. |
| **Stale** | Recorded for an earlier version of the briefing. Redo it. |
| **RPIC Accepted** | Shown on the RPIC's own row. The RPIC is covered by JHA RPIC Acceptance instead. |

---

## 7. The JHA in detail

Open the JHA from **Job File → Open JHA**. There are six steps; the progress bar at the top lets
you jump between them. **Next**, **Back**, clicking a step, and **Save Progress** all save any
changes you've made, so you can stop at any point. If nothing changed, nothing is saved, so
you can page through an approved JHA without affecting the approval.

### Step 1: Mission Basics

- Operator/company
- JHA number
- Remote Pilot in Command
- Date prepared
- Client/property owner
- Job date
- Site address
- Drone platform
- Job type/scope
- Crew members

### Step 2: Site Conditions

- **Required:**
  - Ground/staging surface
  - Work surface/structure type
  - Wind speed (MPH)
  - Weather
  - Visibility
- **Optional:** building height, weather conditions, site access/operational constraints, notes.
- **Public presence:** if the public is present, plan an **exclusion zone** and describe it.
- **Public right-of-way:** answer whether keeping the exclusion zone clear will close or
  restrict a sidewalk, street or other public right-of-way. If **Yes**, record whether a permit
  or authorization is required. If one is required, also record:
  - issuing authority
  - permit number
  - status (**Pending** or **Approved**)
  - dates

  DroneSMS records your determination; it does not decide whether a permit is legally required.
  **Ready to Operate stays blocked until a required permit is Approved.**

### Step 3: Airspace

You need either the **FAA Airspace Class** or the **LAANC Required** answer. Also record:

- relevant airport/heliport
- additional authorization required
- known restrictions/TFRs

If LAANC is required, keep the authorization documentation in the job file before flying.

### Step 4: Environmental

Fill this step in only when the operation could affect the environment. It opens automatically
for service types that use liquids or applied materials.

- Environmental considerations
- **Runoff planning:** potential contaminants, and a containment plan (required). If a chemical
  product is used: chemical type, SDS reviewed, HazCom/PPE communication.
- Water body proximity, type and distance
- Secondary containment
- Reclamation method and volume, and the disposal vendor if a third party
- Regulatory citations (shown when runoff or water-body proximity applies)

### Step 5: Hazards

1. Add hazards from the library suggestions, or select **Add Custom Hazard**. Suggestions are
   optional; only hazards you add become part of the JHA.
2. **Each hazard needs a description, a category and a mitigation.** At least one hazard is
   required.
3. Optionally assign a **Control Owner**: the crew member responsible for implementing or
   monitoring that control.
4. **Add Photo Evidence** to show the control is in place, with a caption. You can also add
   general site photos.

### Step 6: Crew Briefing & Communications

Do this step **in this order**. Changing a checkbox after a sign-off cancels the sign-off.

1. Fill in the **PPE requirements**, **communications** (method, radio channel, communication
   plan reviewed, lost-communication procedure reviewed) and **emergency information** (nearest
   hospital, facility address, emergency contact, drone incident procedure).
2. Check **Crew briefed…** and **Controls are in place before operations begin**.
3. **Safety Manager Review:** the Safety Manager signs in and selects **Complete Safety Manager
   Review**.
4. **RPIC Acceptance:** the assigned RPIC signs in and selects **Accept as RPIC**. If one person holds
   both roles, they still complete both actions.
5. Set **Status** to **Complete** and select **Save JHA**.

The Job File then shows the JHA as **Complete**.

> DroneSMS does not use severity/likelihood scores or Low/Medium/High risk ratings. Safety comes
> from identifying hazards, documenting controls, confirming they're in place, and role-based
> sign-off.

---

## 8. Pre-flight, Ready to Operate, and flying

### 8.1 Pre-Flight Checklist

Open it from **Job File → Open Pre-Flight**. Mark every item **Confirmed**, **Not Applicable**,
or **Not Confirmed**.

| Section | Items |
| --- | --- |
| Aircraft & Equipment | Aircraft selected, battery condition, propellers, firmware/app, GPS/signal, home point, storage/media |
| Environment & Airspace | Weather, wind acceptable, airspace reviewed, LAANC confirmed if required, NOTAM/TFR checked |
| Crew & Safety | Visual observer if needed, emergency procedures, crew communications, **RPIC preflight review** |

- **Save Draft** keeps your progress.
- **Complete Checklist** only works when no item is left unresolved, none are **Not Confirmed**,
  and **RPIC preflight review** is **Confirmed**. Not Applicable isn't accepted for that item.

### 8.2 Ready to Operate

This is the final go/no-go decision, made by the **assigned RPIC** while signed in.

1. Review the **Before approval** list. It names anything still blocking:
   - The JHA is complete, with current Safety Manager Review and RPIC Acceptance.
   - Controls are confirmed in place.
   - The pre-flight checklist is complete.
   - An active RPIC is assigned.
   - Every non-RPIC crew member has a current acknowledgment or manual field briefing.
   - Any required public right-of-way permit is **Approved**.
2. Check the statement that controls are in place and conditions are acceptable.
3. Check the **fitness for duty** statement. Only the confirmation is stored; don't enter medical
   details.
4. Select **Approve Ready to Operate**. **Save as Not Ready** records a no-go instead.

The status then shows **Ready to Operate**. If something changes afterwards, it shows
**Approval Stale** ("Previously approved"), and the RPIC must approve again.

### 8.3 Operation Execution and Safety Events

Fly under the approved JHA and pre-flight controls. **Review Controls** opens the JHA so you can
refer to it on site; viewing it doesn't change anything.

When something unexpected happens (a near miss, a new hazard, a deviation), select **Add Safety
Event** and record:

- **Category:** Operational, Environmental, Equipment, Personnel or Public
- **Outcome:** Resolved, Operation Paused or Operation Terminated
- **Description**
- **Immediate actions taken**

Each event automatically creates a review for the Safety Manager in SMS.

---

## 9. Closeout and packet export

### 9.1 Operation Closeout

1. Choose the **Operation Result**:
   - Completed as Planned
   - Completed with Changes
   - Delayed
   - Aborted
   - Incident Occurred
2. Describe any changes, delays, deviations or abort reasons. This is **required for every
   result except Completed as Planned**.
3. **Post-operation Safety Assurance:** *"Were the safety controls used for this operation
   effective?"* Answer Yes, Partially, No or Not Applicable.
   - **Partially:** say what didn't work as expected and whether anything needs to change before
     a future operation. If it does, choose the follow-up area(s): hazard or control, procedure,
     training or briefing, equipment, or other.
   - **No:** say what didn't work and what action was taken during the operation.
   - You can link the answer to a JHA hazard, control or safety event.
4. Select **Save Operation Closeout**.

Partially and No answers go to the Safety Manager as control-effectiveness reviews. These
assurance details are internal and aren't printed in the client packet.

### 9.2 Export Packet

The **Export Packet** button is enabled once closeout is saved. It builds one PDF that includes:

- the proposal
- the completed job record and job information
- the crew and equipment assignments
- the JHA, with its airspace review
- the pre-flight checklist
- safety events
- closeout

The PDF downloads, and a copy is kept in DroneSMS records.

---

## 10. What resets what

These rules protect the integrity of the record. Knowing them in advance avoids redoing
sign-offs.

| If you change… | Then… |
| --- | --- |
| JHA content: conditions, airspace, environmental, hazards, PPE, emergency info, the crew-briefed or controls-in-place checkboxes | Safety Manager Review and RPIC Acceptance become **stale**, the JHA returns to **Draft**, and Ready to Operate becomes **Approval Stale** |
| **Any other edit to the JHA** after approval (for example the JHA number or permit status) | Ready to Operate becomes **Approval Stale**. Just paging through the JHA without editing doesn't count. |
| Briefing content: JHA scope, hazards, PPE, crew, emergency info, site access, exclusion zone, airspace restrictions | Crew acknowledgments become **Stale**, and unused acknowledgment links stop working |
| Job location, planned date or service type | Crew acknowledgments become **Stale**; Ready to Operate becomes **Approval Stale** |
| Job name | Nothing. Renaming is safe at any time. |
| Crew assignments: add, remove or change a role | Crew acknowledgments become **Stale**; Ready to Operate becomes **Approval Stale** |
| Equipment assignments | Ready to Operate becomes **Approval Stale** |
| The pre-flight checklist | Ready to Operate becomes **Approval Stale** |

**Rule of thumb:** finish planning, then brief, then approve, and don't edit after approving.
Reading the JHA after approval is safe.

---

## 11. Safety Manager follow-up (SMS)

Operational learning comes together on the **SMS** page.

### 11.1 Safety Manager Review: safety events

For each pending event:

1. Open it with **Review**.
2. Record:
   - Was this hazard already known before the event?
   - Was an existing control meant to prevent or reduce it?
   - What happened with that control?
   - Does the event reveal a new hazard or the need for a new control?
3. If there's a new hazard, use **Hazard Library Action** to create or link it, with any new
   mitigation learned. Library actions don't close the event.
4. Choose a resolution:
   - **No organizational change needed**
   - **Add corrective action only**
   - **Continue investigation**
   - **Start change review**, which starts a Management of Change
5. Select **Complete Review**.

### 11.2 Safety Assurance: control-effectiveness reviews

Closeouts answered **Partially** or **No** appear here. Filter by date, job/service, result or
review status. Add review notes and the resulting action, then select **Complete review**.

### 11.3 Management of Change (MOC)

Go to **SMS → Management of Change Reviews → View all change reviews**, or open the register.

1. **Start Change Review:** give the change a title and type, and optionally the affected
   capability. Reviews also start automatically from new-capability equipment and from event
   reviews.
2. Add actions, and complete the ones required before operational use.
3. The Safety Manager decides: **Approve for Operational Use** or **Return for changes**.
4. Follow up: did the change work as intended, were controls effective, were there unexpected
   hazards? Then **Record follow-up and close**.
5. **Export MOC register (Excel)** produces an audit copy.

---

## 12. Working efficiently

### Daily habit

1. Open the **Dashboard**. **Current Operation** shows the next job's stage:
   **Crew Assignment → Equipment Assignment → JHA In Progress → Ready → In Progress → Awaiting
   Closeout**.
   - **Continue Operation** opens that job's File.
2. Work through **Attention Required** from the top. Each item links straight to the fix:
   - Crew assignment missing
   - Equipment assignment missing
   - JHA not completed
   - Closeout required
   - Proposal awaiting review
3. Use **Quick Actions** to create proposals or jobs, or to jump to Personnel or Equipment.

### Office vs. site

| In the office (days before) | On site (day of) |
| --- | --- |
| Proposal, then Create Job | Re-check conditions; JHA edits only if something actually changed |
| Crew and equipment assignments, final | In-person RPIC briefing, then Send Crew Acknowledgments or Record Manual Field Briefing |
| JHA steps 1–5, permits, LAANC | JHA step 6 checkboxes, Safety Manager Review, RPIC Acceptance, Status Complete |
| Check personnel and equipment badges | Pre-Flight Checklist |
| | **Approve Ready to Operate**, then fly |
| | Safety events as they happen; closeout and export the same day |

If the Safety Manager won't be on site, they can complete their review remotely, as long as
nothing in the JHA changes afterwards.

### Habits that save rework

- **Keep master data current.** Personnel certificates, equipment maintenance and Settings feed
  every proposal, JHA and packet.
- **Prefer Proposal → Create Job.** Conversion carries the client, site, airspace, crew,
  equipment and hazards forward.
- **Lock the crew and job details before briefing.** Every later change stales acknowledgments
  and approvals.
- **Don't wait for email when there's no signal.** Manual Field Briefing is a full, designed
  path, not a workaround.
- **Close out the same day.** The packet can't be exported until closeout is saved, and the
  details are freshest right after the flight.

---

## 13. Troubleshooting blocker messages

| Message or symptom | What to do |
| --- | --- |
| *Safety Manager not designated. Configure a Safety Manager in SMS.* | The owner designates an active person in **SMS → Safety Manager Configuration**. |
| *Only the designated Safety Manager / assigned RPIC can complete this… while signed in.* | Sign in as the account linked to that personnel record. |
| *RPIC not assigned to this job.* | Job File → Crew Assignment → add a person with role **RPIC**. |
| *Safety Manager re-review / RPIC re-acceptance is required…* | JHA content changed after a sign-off. Use **Complete Required Re-review** and **Complete Required Re-acceptance**, then mark the JHA Complete again. |
| *Confirm that the crew briefing was completed / required controls are in place…* | Check both boxes in JHA step 6, **before** the sign-offs. |
| *Each hazard needs a description, category, and mitigation.* | Complete or remove incomplete hazard rows in step 5. |
| *Airspace class or LAANC status is required.* | Fill in one of them in step 3. |
| *Save the Operational JHA before sending crew acknowledgments.* | Save the JHA at least once. |
| *Add a usable email to this personnel record before sending.* | Fix the email, or use **Record Manual Field Briefing**. |
| *The briefing has changed. Ask the RPIC for a new acknowledgment request.* | The crew member's link is out of date. The RPIC sends again, or records a manual briefing. |
| *Every assigned non-RPIC operational crew member needs a current Crew Briefing acknowledgment or Manual Field Briefing.* | Find the rows showing Not Sent, Sent or Stale, and complete them by either path. |
| *Required public right-of-way permit or authorization must be Approved.* | Update the permit status in JHA step 2 once you have it. |
| *Resolve checks marked Not Confirmed…* (pre-flight) | Fix the issue and mark it Confirmed, or Not Applicable where allowed. |
| Ready to Operate shows **Approval Stale** | Something changed after approval (see [section 10](#10-what-resets-what)). Resolve any new blockers, and the RPIC approves again. |
| **Export Packet** is disabled | Save the Operation Closeout first. |

---

## 14. Known beta limitations

- **Reports** is a placeholder ("coming soon").
- Some **Account Settings** cards are placeholders.
- Personnel records link to the account that created them, so sign-offs by separate RPIC or
  Safety Manager accounts depend on who created each record.
- Billing, multi-company accounts, admin tools and offline use are planned, not available.

Report anything that looks wrong. DroneSMS is in beta and your feedback guides fixes.

---

## 15. Quick reference

| I want to… | Go to |
| --- | --- |
| See what needs attention | Dashboard |
| Quote a client | Proposals → Create Proposal |
| Start an operation | Jobs → Create Job, or **Create Job** on a proposal |
| Assign crew and equipment, run the operation | Job → Job File |
| Do the hazard analysis | Job File → Open JHA |
| Brief crew without email | Job File → Crew Briefing → Record Manual Field Briefing |
| Run the pre-flight | Job File → Open Pre-Flight |
| Give the go/no-go | Job File → Ready to Operate (assigned RPIC) |
| Get the final PDF | Job File → Export Packet (after closeout) |
| Add or update people or aircraft | Personnel / Equipment |
| Change company info or proposal defaults | Settings → Organization |
| Change password or email | Settings → Account Settings |
| Designate Safety Manager, review events, run MOC | SMS |
