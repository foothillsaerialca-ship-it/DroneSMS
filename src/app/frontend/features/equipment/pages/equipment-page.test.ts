/**
 * File purpose: Verifies the Equipment page's Management of Change entry points and card actions.
 * Fallback/error behavior: Assertions inspect page source, so they do not depend on Supabase availability.
 * Known limitation: These tests do not render React components or execute MOC RPCs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const equipmentPage = readFileSync(new URL('./equipment-page.tsx', import.meta.url), 'utf8');
const mocRegisterPage = readFileSync(new URL('../../sms/pages/moc-register-page.tsx', import.meta.url), 'utf8');
const safetyReviewArea = readFileSync(new URL('../../sms/components/safety-review-area.tsx', import.meta.url), 'utf8');
const router = readFileSync(new URL('../../../../router.tsx', import.meta.url), 'utf8');
const equipmentCards = equipmentPage.slice(equipmentPage.indexOf('filteredEquipment.map((item) =>'));

test('equipment cards no longer render an unconditional change review shortcut', () => {
  assert.ok(equipmentCards.length < equipmentPage.length);
  assert.doesNotMatch(equipmentPage, /Start Change Review/);
  assert.doesNotMatch(equipmentPage, /to="\/sms\/moc"/);
});

test('equipment cards keep their Edit and Delete actions', () => {
  assert.match(equipmentCards, /onClick=\{\(\) => handleEdit\(item\)\}>\s*Edit\s*<\/button>/);
  assert.match(equipmentCards, /onClick=\{\(\) => void handleDelete\(item\)\}/);
  assert.match(equipmentCards, /\{isDeleting \? 'Deleting\.\.\.' : 'Delete'\}/);
});

test('equipment creation still offers the new operational capability review', () => {
  assert.match(equipmentPage, /\{!editingEquipmentId\?<><label className="[^"]*">Does this equipment introduce a new operational capability\?/);
  assert.match(equipmentPage, /if \(formData\.introducesNewCapability === 'Yes'\) \{\s*if \(!formData\.capabilityName\.trim\(\)\)/);
  assert.match(equipmentPage, /supabase\.rpc\('start_management_of_change', \{/);
  assert.match(equipmentPage, /change_source: 'Equipment',\s*requested_change_type: 'New operational capability',\s*linked_equipment_id: inserted\.id,/);
  assert.match(equipmentPage, /capability_name: formData\.capabilityName\.trim\(\),/);
  assert.match(equipmentPage, /<Link className="font-semibold underline" to=\{`\/sms\/moc\/\$\{createdMocId\}`\}>Review now<\/Link>/);
  assert.match(equipmentPage, /onClick=\{\(\)=>setCreatedMocId\(null\)\}>Review later<\/button>/);
});

test('manual MOC creation remains available from the register and SMS area', () => {
  assert.match(router, /<Route path="\/sms\/moc" element=\{<MocRegisterPage \/>\} \/>/);
  assert.match(router, /<Route path="\/sms\/moc\/:mocId" element=\{<MocDetailPage \/>\} \/>/);
  assert.match(mocRegisterPage, /<button onClick=\{\(\)=>setOpen\(true\)\}[^>]*>Start Change Review<\/button>/);
  assert.match(mocRegisterPage, /<form onSubmit=\{start\}/);
  assert.match(mocRegisterPage, /supabase\.rpc\('start_management_of_change',\{change_title:form\.title\.trim\(\)/);
  assert.match(safetyReviewArea, /<Link className="[^"]*" to="\/sms\/moc">Start Change Review<\/Link>/);
});
