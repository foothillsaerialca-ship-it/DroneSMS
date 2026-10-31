import assert from 'node:assert/strict';
import test from 'node:test';
import { getPart107ReportDeadline, isPart107ReportableEvent, isPart107WeatherMinimumMet, requiresPart107AtcAuthorization } from './part107-compliance.ts';

test('Part 107 accident reportability uses strict greater-than damage thresholds and injury triggers', () => {
  const base = { seriousInjury: false, lossOfConsciousness: false, nonSuasPropertyDamageCostUsd: 0, propertyTotalLoss: false, propertyFairMarketValueUsd: null };
  assert.equal(isPart107ReportableEvent(base), false);
  assert.equal(isPart107ReportableEvent({ ...base, nonSuasPropertyDamageCostUsd: 500 }), false);
  assert.equal(isPart107ReportableEvent({ ...base, nonSuasPropertyDamageCostUsd: 500.01 }), true);
  assert.equal(isPart107ReportableEvent({ ...base, propertyTotalLoss: true, propertyFairMarketValueUsd: 500 }), false);
  assert.equal(isPart107ReportableEvent({ ...base, propertyTotalLoss: true, propertyFairMarketValueUsd: 500.01 }), true);
  assert.equal(isPart107ReportableEvent({ ...base, nonSuasPropertyDamageCostUsd: 800, propertyTotalLoss: true, propertyFairMarketValueUsd: 500 }), false);
  assert.equal(isPart107ReportableEvent({ ...base, seriousInjury: true }), true);
  assert.equal(isPart107ReportableEvent({ ...base, lossOfConsciousness: true }), true);
});

test('reporting deadline is ten calendar days after the operation date', () => {
  assert.equal(getPart107ReportDeadline('2026-10-25'), '2026-11-04');
  assert.equal(getPart107ReportDeadline('invalid'), null);
});

test('ATC authorization is required for B, C, D, and designated Class E surface areas only', () => {
  for (const airspaceClass of ['B', 'C', 'D']) assert.equal(requiresPart107AtcAuthorization(airspaceClass, false), true);
  assert.equal(requiresPart107AtcAuthorization('E', true), true);
  assert.equal(requiresPart107AtcAuthorization('E', false), false);
  assert.equal(requiresPart107AtcAuthorization('G', false), false);
});

test('weather checks use the Part 107 visibility and cloud clearances', () => {
  const legalMinimum = { visibilityStatuteMiles: 3, cloudClearanceBelowFeet: 500, cloudHorizontalDistanceFeet: 2000 };
  assert.equal(isPart107WeatherMinimumMet(legalMinimum), true);
  assert.equal(isPart107WeatherMinimumMet({ ...legalMinimum, visibilityStatuteMiles: 2.9 }), false);
  assert.equal(isPart107WeatherMinimumMet({ ...legalMinimum, cloudClearanceBelowFeet: 499 }), false);
  assert.equal(isPart107WeatherMinimumMet({ ...legalMinimum, cloudHorizontalDistanceFeet: 1999 }), false);
});
