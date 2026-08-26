/**
 * File purpose: Centralizes shared proposal/job option lists and persisted equipment-assignment normalization.
 * Fallback/error behavior: malformed equipment collections normalize to an empty list and malformed entries are omitted.
 * Known issues: option values must remain aligned with persisted database values and existing migration defaults.
 */

/**
 * Purpose: Defines canonical service labels used by job, proposal, and hazard workflows.
 * Fallback/error behavior: the first value is the default for new records; legacy labels are normalized by the hazard-library compatibility layer.
 * Known limitation: adding or renaming a value requires coordinated review of persisted records, scope defaults, and hazard mappings.
 */
export const serviceTypes = [
  'Cleaning Operations',
  'Thermal Inspection',
  'Roof Inspection',
  'Agricultural',
  'Mapping / Surveying',
  'Construction Progress',
  'Real Estate / Property Media',
  'Custom Operation'
] as const;

/**
 * Purpose: Restricts new workflow service values to the canonical service option list.
 * Fallback/error behavior: persisted values remain strings until explicitly normalized because database data is not validated by this compile-time union.
 * Known limitation: TypeScript cannot reject an unsupported value returned by Supabase at runtime.
 */
export type ServiceType = (typeof serviceTypes)[number];

/**
 * Purpose: Defines every proposal lifecycle status accepted by proposal forms and repository actions.
 * Fallback/error behavior: new proposals use the first value, `Draft`; unsupported persisted values must be handled by the loading form.
 * Known limitation: database constraints and this list must be kept synchronized manually.
 */
export const proposalStatuses = ['Draft', 'Sent', 'Under Review', 'Accepted', 'Declined'] as const;

/**
 * Purpose: Restricts proposal status values to the shared lifecycle list.
 * Fallback/error behavior: callers loading untyped records must validate or narrow status strings before mutation.
 * Known limitation: the union supplies no runtime validation for Supabase responses.
 */
export type ProposalStatus = (typeof proposalStatuses)[number];

/**
 * Represents an equipment snapshot embedded in a proposal.
 * Fallback/error behavior: nullable make/model values and empty descriptive strings preserve legacy snapshots with incomplete optional metadata.
 * Known limitation: snapshots can become stale after their source equipment record changes.
 */
export type ProposalEquipmentAssignment = {
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  make: string | null;
  model: string | null;
  status: string;
  purpose: string;
};

/**
 * Converts untrusted proposal JSON into complete equipment snapshots.
 * Fallback/error behavior: non-arrays return an empty list; entries without both an ID and name are discarded and missing optional fields use empty/null defaults.
 */
export function normalizeProposalEquipment(value: unknown): ProposalEquipmentAssignment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item as Partial<ProposalEquipmentAssignment>;
      const equipmentId = typeof record.equipment_id === 'string' ? record.equipment_id : '';
      const equipmentName = typeof record.equipment_name === 'string' ? record.equipment_name : '';
      if (!equipmentId || !equipmentName) return null;

      return {
        equipment_id: equipmentId,
        equipment_name: equipmentName,
        equipment_type: typeof record.equipment_type === 'string' ? record.equipment_type : '',
        make: typeof record.make === 'string' ? record.make : null,
        model: typeof record.model === 'string' ? record.model : null,
        status: typeof record.status === 'string' ? record.status : '',
        purpose: typeof record.purpose === 'string' ? record.purpose : ''
      } satisfies ProposalEquipmentAssignment;
    })
    .filter((item): item is ProposalEquipmentAssignment => Boolean(item));
}
