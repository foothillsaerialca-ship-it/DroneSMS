/**
 * File purpose: A representative job and saved JHA with three documented hazards for Hazard Assessment tests. Values are fictitious.
 * Fallback/error behavior: Not applicable; static fixture data.
 * Known limitation: The assessment row carries only the columns needed to load the Hazards step; other fields use page defaults.
 */
import { testOrganizationId, testUserId } from '../render';

export const jhaJob = {
  id: 'job-jha',
  organization_id: testOrganizationId,
  source_proposal_id: null,
  name: 'Solar Array Inspection',
  service_type: 'Solar Panel Cleaning',
  location: 'Fresno, CA',
  planned_date: '2026-11-02',
  status: 'Scheduled',
  client_name: 'Example Energy Co',
  site_address: '100 Example Way, Fresno, CA',
  preliminary_hazards: null
};

export const windHazard = {
  id: 'hazard-wind',
  description: 'High wind gusts during flight',
  category: 'Weather',
  mitigation: 'Ground the aircraft when gusts exceed limits.',
  owner: '',
  notes: '',
  sourceType: 'Library'
};

export const trafficHazard = {
  id: 'hazard-traffic',
  description: 'Vehicle traffic near staging area',
  category: 'Ground Operations',
  mitigation: 'Cone off the staging area.',
  owner: '',
  notes: '',
  sourceType: 'Library'
};

export const powerLineHazard = {
  id: 'hazard-power',
  description: 'Overhead power lines',
  category: 'Obstacles',
  mitigation: 'Maintain lateral separation from conductors.',
  owner: '',
  notes: '',
  sourceType: 'Library'
};

export const documentedHazards = [windHazard, trafficHazard, powerLineHazard];

export const savedAssessment = {
  id: 'jha-1',
  job_id: jhaJob.id,
  organization_id: testOrganizationId,
  user_id: testUserId,
  status: 'Draft',
  hazard_entries: documentedHazards
};
