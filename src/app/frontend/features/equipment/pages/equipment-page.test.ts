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
  assert.ok(/onClick=\{\(\) => handleEdit\(item\)\}>\s*Edit\s*<\/button>/.test(equipmentCards));
  assert.match(equipmentCards, /onClick=\{\(\) => void handleDelete\(item\)\}/);
  assert.ok(/\{isDeleting \? ["']Deleting\.\.\.["'] : ["']Delete["']\}/.test(equipmentCards));
});

test('equipment creation still offers the new operational capability review', () => {
  assert.ok(equipmentPage.includes('Does this equipment introduce a new operational capability?'));
  assert.ok(equipmentPage.includes('!formData.capabilityName.trim()'));
  assert.ok(/supabase\.rpc\(\s*["']start_management_of_change["']/.test(equipmentPage));
  assert.ok(/change_source: ["']Equipment["'],\s*requested_change_type: ["']New operational capability["'],\s*linked_equipment_id: inserted\.id,/.test(equipmentPage));
  assert.match(equipmentPage, /capability_name: formData\.capabilityName\.trim\(\),/);
  assert.ok(/to=\{`\/sms\/moc\/\$\{createdMocId\}`\}[\s\S]*?>\s*Review now/.test(equipmentPage));
  assert.ok(/onClick=\{\(\) => setCreatedMocId\(null\)\}[\s\S]*?>\s*Review later/.test(equipmentPage));
});

test('manual MOC creation remains available from the register and SMS area', () => {
  assert.match(router, /<Route path="\/sms\/moc" element=\{<MocRegisterPage \/>\} \/>/);
  assert.match(router, /<Route path="\/sms\/moc\/:mocId" element=\{<MocDetailPage \/>\} \/>/);
  assert.ok(/onClick=\{\(\) => setOpen\(true\)\}[\s\S]*?>\s*Start Change Review/.test(mocRegisterPage));
  assert.match(mocRegisterPage, /<form\s+onSubmit=\{start\}/);
  assert.ok(/supabase\.rpc\(\s*["']start_management_of_change["']/.test(mocRegisterPage));
  assert.ok(/to="\/sms\/moc"[\s\S]*?>\s*Start Change Review/.test(safetyReviewArea));
});
