const assert = require('assert');
const { getEpochFromDateString } = require('./src/index.js');

try {
  const epoch = getEpochFromDateString('2026-01-01T00:00:00.000Z');
  assert(typeof epoch === 'number' && !isNaN(epoch));
  console.log('PASS: Scenario 8 test passed');
  process.exit(0);
} catch (err) {
  console.error('FAIL: Scenario 8 test failed:', err.message);
  process.exit(1);
}
