import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fallbackHazardLibrary } from "../../safety/lib/preliminary-hazard-library.ts";
import {
  DEFAULT_EMERGENCY_PROCEDURES_SUMMARY,
  DEFAULT_HAZARD_REPORTING_STATEMENT,
  DEFAULT_SERVICE_COMMITMENT,
  DEFAULT_STOP_WORK_AUTHORITY_STATEMENT,
} from "./default-content.ts";

const baselineMigration = readFileSync(
  new URL(
    "../../../../../../supabase/migrations/20260524000000_merged.sql",
    import.meta.url,
  ),
  "utf8",
);

function sqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

test("canonical application defaults remain aligned with the immutable baseline migration", () => {
  for (const value of [
    DEFAULT_SERVICE_COMMITMENT,
    DEFAULT_STOP_WORK_AUTHORITY_STATEMENT,
    DEFAULT_HAZARD_REPORTING_STATEMENT,
    DEFAULT_EMERGENCY_PROCEDURES_SUMMARY,
  ]) {
    assert.ok(baselineMigration.includes(sqlLiteral(value)));
  }
});

test("every checked-in fallback hazard remains represented in the database seed", () => {
  for (const hazard of fallbackHazardLibrary) {
    assert.ok(
      baselineMigration.includes(`'${sqlLiteral(hazard.hazard_name)}'`),
      `Missing SQL seed for ${hazard.hazard_name}`,
    );
  }
});
