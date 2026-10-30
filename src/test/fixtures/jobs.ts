/**
 * File purpose: Representative Jobs and Proposals records for component tests. All values are fictitious.
 * Fallback/error behavior: Not applicable; static fixture data.
 * Known limitation: Rows carry only the columns the Jobs page selects.
 */
import { testOrganizationId } from '../render';

export const activeJob = {
  id: 'job-active',
  name: 'Solar Array Inspection',
  service_type: 'Solar Panel Cleaning',
  location: 'Fresno, CA',
  planned_date: '2026-11-02',
  status: 'Scheduled',
  archived_at: null
};

export const completedJob = {
  id: 'job-completed',
  name: 'Warehouse Roof Survey',
  service_type: 'Roof Inspection',
  location: 'Visalia, CA',
  planned_date: '2026-09-14',
  status: 'Completed',
  archived_at: null
};

export const archivedJob = {
  id: 'job-archived',
  name: 'Radio Tower Wash',
  service_type: 'Tower Cleaning',
  location: 'Hanford, CA',
  planned_date: '2026-06-01',
  status: 'Completed',
  archived_at: '2026-07-01T12:00:00.000Z'
};

export const draftProposal = {
  id: 'proposal-draft',
  organization_id: testOrganizationId,
  proposal_number: 'P-1001',
  proposal_name: 'Office Window Wash Proposal',
  client_name: 'Example Property Group',
  contact_name: null,
  phone: null,
  email: null,
  service_type: 'Window Cleaning',
  site_address: null,
  status: 'Draft',
  created_at: '2026-10-01T09:00:00.000Z',
  hazard_assessment: [],
  proposal_equipment: [],
  proposal_personnel: [],
  proposed_rpic_id: null,
  proposed_rpic_name: null,
  proposed_rpic_credentials: null,
  proposed_rpic_bio: null,
  converted_to_job: false,
  converted_job_id: null,
  converted_at: null
};
