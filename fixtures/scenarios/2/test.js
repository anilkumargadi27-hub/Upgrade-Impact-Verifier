const assert = require('assert');
const mathLib = require('mock-math-lib');

try {
  const res = mathLib.calculateTax(100);
  assert.strictEqual(res, 105);
  console.log('PASS: Scenario 2 test passed');
  process.exit(0);
} catch (err) {
  console.error('FAIL: Scenario 2 test failed:', err.message);
  process.exit(1);
}
