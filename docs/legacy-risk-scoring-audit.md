# Legacy risk-scoring audit

Audit date: 2026-09-03

This audit distinguishes obsolete scored/classified risk assessment from legitimate Safety Management System terminology and descriptive uses of risk.

| Reference | Classification | Decision |
| --- | --- | --- |
| `jha_assessments.overall_risk_rating` and its `Low` default | Legacy, retained for history | Keep the nullable column so historical rows remain readable; remove its default and `NOT NULL` constraint. Current JHA saves, completion, attestations, readiness, and packet exports do not reference it. |
| `proposals.risk` | Legacy, retained for history | Keep the nullable column for historical and mixed-version compatibility. Current proposal form, PDF query/rendering, and proposal-to-job conversion do not select, display, or populate it. |
| `proposals.hazard` and `proposals.proposed_mitigation` | Active and still required | These are descriptive hazard/control fields, not scored risk. They remain in proposal loading and rendering as backward-compatible fallbacks for the current structured `hazard_assessment`. |
| `proposals.hazard_assessment` | Active and still required | Current Preliminary Hazard Assessment data: hazard name, category, mitigation/control text, source, and notes. |
| JHA `runoff_risk` | Active and still required | A boolean environmental condition used for containment planning and packet content; it is not an operational score or classification. |
| “Safety Risk Management” | Active and still required | The recognized SMS pillar; retained intentionally. Its inactive “Risk Matrix Configuration” placeholder was removed. |
| Stop-work language mentioning an environmental `risk` | Active and still required | Ordinary safety language, not a score or classification. |
| Information-page references to risk management | Active and still required | Describes the SMS discipline rather than a matrix or rating. |
| Implementation-plan “risk scoring,” “risk engine,” and “risk warnings” | Documentation-only | Historical planning language with no implementing application component. Retained as an implementation-history artifact; it does not describe active behavior. |
| Severity, likelihood, residual risk, numerical scores, MIL-STD terminology, and pre-job ratings | Fully inactive/dead | No application, schema, function, view, RPC, export, helper, type, fixture, or component implementing these concepts was found. |

## Current JHA architecture

The current Operational JHA records identified hazards, hazard categories, control/mitigation text, optional control ownership, controls-in-place and crew-briefing confirmations, Safety Manager review, and RPIC acceptance. Ready to Operate separately verifies that the completed JHA and its attestations are current, controls are in place, preflight is complete, an RPIC is assigned, and fitness for duty is confirmed.

No severity, likelihood, matrix, numerical score, residual-risk score, or Low/Medium/High operational classification participates in these paths. The cleanup migration changes no JHA completion or Ready to Operate logic.

## Compatibility decision

Dropping either legacy column would add avoidable migration and mixed-version risk. The migration therefore changes no historical row and fabricates no replacement value. Existing historical values remain available to old records, while new records receive `NULL` because active inserts omit both legacy fields and the JHA default is removed.
