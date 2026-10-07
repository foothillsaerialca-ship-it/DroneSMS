/**
 * File purpose: Verifies proposal organization logos use proportional contain-style placement.
 * Fallback/error behavior: Assertions fail if logo geometry or proposal placement regresses to cropping or distortion.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { containImage } from './organization-logo-layout.ts';

const bounds = { x: 100, y: 200, width: 240, height: 100 };

for (const example of [
  { name: 'wide ClearSky-style', width: 600, height: 120, expectedWidth: 240, expectedHeight: 48 },
  { name: 'square', width: 300, height: 300, expectedWidth: 100, expectedHeight: 100 },
  { name: 'tall', width: 120, height: 600, expectedWidth: 20, expectedHeight: 100 },
]) {
  test(`${example.name} organization logo remains complete, proportional, and centered`, () => {
    const result = containImage(example, bounds);
    assert.equal(result.width, example.expectedWidth);
    assert.equal(result.height, example.expectedHeight);
    assert.equal(result.width / result.height, example.width / example.height);
    assert.equal(result.x + result.width / 2, bounds.x + bounds.width / 2);
    assert.equal(result.y + result.height / 2, bounds.y + bounds.height / 2);
    assert.ok(result.width <= bounds.width && result.height <= bounds.height);
  });
}

test('proposal cover, headers, and watermark use contained logos without a circular clipping path', () => {
  const source = readFileSync(new URL('./proposal-pdf.ts', import.meta.url), 'utf8');
  const proposalRenderer = source.slice(source.indexOf('class ProposalPdfRenderer'), source.indexOf('export async function generateProposalPdf'));

  assert.doesNotMatch(proposalRenderer, /drawCircularImage/);
  assert.match(proposalRenderer, /drawContainedLogo\(this\.currentPage, \{ x: centerX - 120, y: PAGE_HEIGHT - 210, width: 240, height: 108 \}\)/);
  assert.match(proposalRenderer, /drawContainedLogo\(page, \{ x: PAGE_WIDTH - MARGIN - 84, y: PAGE_HEIGHT - 60, width: 84, height: 46 \}\)/);
  assert.match(source, /proposalSubtitle\(this\.proposal\).*PAGE_HEIGHT - 270/);
  assert.match(source, /this\.y = CONTENT_START_Y/);
});
