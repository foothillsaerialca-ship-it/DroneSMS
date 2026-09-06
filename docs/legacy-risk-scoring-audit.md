# Legacy risk-scoring audit

Original audit date: 2026-09-03

Retrospective verification date: 2026-09-04

This audit distinguishes obsolete scored/classified risk assessment from legitimate Safety Management System terminology and descriptive uses of risk.

| Reference | Classification | Decision |
| --- | --- | --- |
| `jha_assessments.overall_risk_rating` and its former `Low` default | **Legacy but still required for historical compatibility** | Keep the nullable column so historical and mixed-version rows remain readable. The 2026-09-03 migration removed only its default and `NOT NULL` constraint and did not update old values. Current JHA load/save/completion, role attestations, Ready to Operate, crew briefing, Safety Assurance, and packet exports neither inspect nor populate it. No corrective change was required. |
| `proposals.risk` | **Legacy but still required for historical compatibility** | Keep the nullable column so historical and mixed-version rows remain readable. It has always been nullable and the cleanup changed only its comment. Current proposal create/edit/list/PDF and proposal-to-job conversion paths neither inspect nor populate it. No corrective change was required. |
| `proposals.hazard` and `proposals.proposed_mitigation` | Active and still required | These are descriptive hazard/control fields, not scored risk. They remain in proposal loading and rendering as backward-compatible fallbacks for the current structured `hazard_assessment`. |
| `proposals.hazard_assessment` | Active and still required | Current Preliminary Hazard Assessment data: hazard name, category, mitigation/control text, source, and notes. |
| JHA `runoff_risk` | Active and still required | A boolean environmental condition used for containment planning and packet content; it is not an operational score or classification. |
| “Safety Risk Management” | Active and still required | The recognized SMS pillar; retained intentionally. Its inactive “Risk Matrix Configuration” placeholder was removed. |
| Stop-work language mentioning an environmental `risk` | Active and still required | Ordinary safety language, not a score or classification. |
| Information-page references to risk management | Active and still required | Describes the SMS discipline rather than a matrix or rating. |
| Implementation-plan “risk scoring,” “risk engine,” and “risk warnings” | Outdated documentation | Corrected to operational-condition warnings and explicitly marked the plan as non-authoritative. Archived binary briefs/templates are identified as superseded reference artifacts in `docs/README.md`. |
| Severity, likelihood, residual risk, numerical scores, MIL-STD terminology, and pre-job ratings | Fully inactive/dead | No application, schema, function, view, RPC, export, helper, type, fixture, or component implementing these concepts was found. |

## Current JHA architecture

The current Operational JHA records identified hazards, hazard categories, control/mitigation text, optional control ownership, controls-in-place and crew-briefing confirmations, Safety Manager review, and RPIC acceptance. Ready to Operate separately verifies that the completed JHA and its attestations are current, controls are in place, preflight is complete, an RPIC is assigned, and fitness for duty is confirmed.

No severity, likelihood, matrix, numerical score, residual-risk score, or Low/Medium/High operational classification participates in these paths. The cleanup migration changes no JHA completion or Ready to Operate logic.

## Compatibility decision

Dropping either legacy column would add avoidable migration and mixed-version risk. The migration therefore changes no historical row and fabricates no replacement value. Existing historical values remain available to old records, while new records receive `NULL` because active inserts omit both legacy fields and the JHA default is removed.

The migration is compatible with the original schema: removing a default and `NOT NULL`
constraint does not rewrite existing rows, both columns remain selectable, and repeated
`DROP DEFAULT`/`DROP NOT NULL` operations are harmless. `proposals.risk` was already nullable.
No RLS policy, grant, trigger, RPC signature, or export query was changed by the cleanup.

## Suspected legacy JHA fields (2026-09-04)

| Field | Classification | Evidence and decision |
| --- | --- | --- |
| `stop_work_authority_acknowledged` | **Active but redundant / candidate for future consolidation** | The current JHA loader reads it and the upsert writes it. The present UI communicates stop-work authority through the crew-briefing confirmation and RPIC Acceptance, and completion/readiness use `crew_briefed`, `controls_in_place`, current attestations, and briefing acknowledgments rather than this scalar. Because it remains in the live form state/save contract and may preserve older acknowledgments, it is not safe to remove in this pass. Removing the column now would break the current upsert and discard historical evidence; removing only the form field needs an explicit product/data migration decision. |
| `assessor_name` | **Legacy but required for backward compatibility/history** | Declared as a nullable column in the original JHA schema, with no current frontend, RPC, trigger, export, helper, type, fixture, or test consumer. Current identity evidence is captured by authenticated Safety Manager and RPIC attestations. Preserve the column and old values; dropping it would erase historical attribution and could break mixed-version clients. |
| `assessment_date` | **Legacy but required for backward compatibility/history** | Declared as a nullable column in the original JHA schema, with no current consumer. Current records use `date_prepared`, `certified_at`, role-attestation timestamps, and audit timestamps. Preserve it without reinterpretation because old values may be historical evidence. |
| `rpic_printed_name` | **Legacy but required for backward compatibility/history** | Declared as a nullable column in the original JHA schema, with no current consumer. Current RPIC identity comes from the assigned personnel record and authenticated `rpic_name`/`rpic_accepted_at` attestation snapshot. Preserve old values for history and mixed-version compatibility. |

The three legacy-only fields remain nullable and are omitted by new JHA writes, so they create
no insertion/default problem. JHA loading uses `select('*')` and tolerates old rows; no loader
rewrites or reinterprets these values. No schema change is warranted solely to label fields that
must remain available for compatibility.

## Retrospective workflow verification

The active paths were re-traced through JHA creation/editing/completion, Safety Manager Review,
RPIC Acceptance, Ready to Operate, Preflight, public and manual Crew Briefing acknowledgments,
proposal creation/editing/PDF generation, proposal-to-job conversion, operational packet and
closeout exports, Management of Change, and Safety Assurance. None relies on classified or
scored operational risk. Descriptive hazards, consequences, mitigations, control owners,
controls-in-place confirmation, environmental `runoff_risk`, and legitimate Safety Risk
Management language remain intact.

The removed Risk Acceptance Criteria / Risk Matrix Configuration labels were inactive pillar
placeholders, not controls or navigation targets. Replacing them with Hazard Identification &
Control Planning and Controls-in-Place Verification did not disconnect a route, RPC, persisted
setting, or readiness prerequisite. No previously removed behavior needs to be restored.
