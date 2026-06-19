alter table public.organizations
  alter column stop_work_authority_statement set default 'Every crew member has the authority and responsibility to immediately stop work whenever an unsafe condition, unforeseen hazard, equipment malfunction, regulatory concern, or environmental risk is identified. Operations will not resume until the hazard has been evaluated and appropriate controls have been implemented or the risk has been reduced to an acceptable level.',
  alter column hazard_reporting_statement set default 'All personnel are expected to promptly report hazards, near misses, equipment deficiencies, procedural concerns, and safety observations. Hazard reports are used to improve operations through corrective action and continuous learning, not to assign blame. Timely reporting supports a proactive safety culture and strengthens operational decision-making.',
  alter column emergency_procedures_summary set default 'In the event of an emergency, operations shall cease immediately. Personnel will prioritize the protection of life, notify emergency services when required, secure the operating area, and preserve the scene when appropriate. The Remote Pilot in Command will document the event, notify affected parties as required, and initiate post-event review and corrective actions before operations resume.';

update public.organizations
set stop_work_authority_statement = 'Every crew member has the authority and responsibility to immediately stop work whenever an unsafe condition, unforeseen hazard, equipment malfunction, regulatory concern, or environmental risk is identified. Operations will not resume until the hazard has been evaluated and appropriate controls have been implemented or the risk has been reduced to an acceptable level.'
where nullif(btrim(stop_work_authority_statement), '') is null;

update public.organizations
set hazard_reporting_statement = 'All personnel are expected to promptly report hazards, near misses, equipment deficiencies, procedural concerns, and safety observations. Hazard reports are used to improve operations through corrective action and continuous learning, not to assign blame. Timely reporting supports a proactive safety culture and strengthens operational decision-making.'
where nullif(btrim(hazard_reporting_statement), '') is null;

update public.organizations
set emergency_procedures_summary = 'In the event of an emergency, operations shall cease immediately. Personnel will prioritize the protection of life, notify emergency services when required, secure the operating area, and preserve the scene when appropriate. The Remote Pilot in Command will document the event, notify affected parties as required, and initiate post-event review and corrective actions before operations resume.'
where nullif(btrim(emergency_procedures_summary), '') is null;
