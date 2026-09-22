import assert from 'node:assert/strict';
import test from 'node:test';
import { createFormSnapshot } from './form-snapshot.ts';

test('form snapshots omit empty values but preserve selected false and zero values', () => {
  assert.deepEqual(createFormSnapshot({
    emptyText: ' ',
    missing: null,
    selected: false,
    count: 0,
    nested: { empty: '', value: 'kept' },
    emptyArray: [],
    values: ['kept', '', null],
  }), {
    selected: false,
    count: 0,
    nested: { value: 'kept' },
    values: ['kept'],
  });
});
