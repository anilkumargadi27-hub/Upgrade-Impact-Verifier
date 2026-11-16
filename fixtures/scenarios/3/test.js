const assert = require('assert');
const { doWork } = require('./src/index.js');

try {
  const res = doWork();
  assert.strictEqual(res, 'done');
  console.log('PASS: Scenario 3 test passed');
  process.exit(0);
} catch (err) {
  console.error('FAIL: Scenario 3 test failed:', err.message);
  process.exit(1);
}
