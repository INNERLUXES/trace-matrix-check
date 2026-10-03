import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALE, atLeast, atMost, percentText, scaledPercent, thresholdText } from '../src/index.js';

test('ratio: a percentage with at most four decimals is kept as a whole number', () => {
  assert.equal(SCALE, 10000);
  assert.equal(scaledPercent(99.9), 999000);
  assert.equal(scaledPercent(0), 0);
  assert.equal(scaledPercent(100), 1000000);
  assert.equal(scaledPercent(33.3333), 333333);
  assert.equal(scaledPercent(0.0001), 1);
  for (const bad of [95.00001, -1, 100.5, Number.NaN, Number.POSITIVE_INFINITY, '50']) assert.equal(scaledPercent(bad), null, String(bad));
});

test('ratio: shares are compared with whole numbers, so a share just under a limit is under it', () => {
  assert.equal(atLeast(2, 3, scaledPercent(66.6666)), true);
  assert.equal(atLeast(2, 3, scaledPercent(66.6667)), false);
  assert.equal(atLeast(94999, 100000, scaledPercent(95)), false);
  assert.equal(atLeast(95, 100, scaledPercent(95)), true, 'a share at the limit is met');
  assert.equal(atMost(5, 100, scaledPercent(5)), true);
  assert.equal(atMost(5001, 100000, scaledPercent(5)), false);
});

test('ratio: a share is shown cut down to two decimals, never rounded up, and a limit as written', () => {
  assert.equal(percentText(2, 3), '66.66%');
  assert.equal(percentText(94999, 100000), '94.99%');
  assert.equal(percentText(1, 1), '100%');
  assert.equal(percentText(197, 200), '98.5%');
  assert.equal(percentText(1, 0), 'n/a');
  assert.equal(thresholdText(scaledPercent(99.9)), '99.9%');
  assert.equal(thresholdText(scaledPercent(40)), '40%');
});
