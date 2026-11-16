const assert = require('assert');
const { renderReportDate } = require('./src/index.js');

try {
  const now = new Date('2026-01-01T00:00:00Z');
  const res = renderReportDate(now);
  assert(res.includes('2026-01-01'), `Expected date string, got: ${res}`);
  console.log('PASS: Scenario 1 test passed');
  process.exit(0);
} catch (err) {
  console.error('FAIL: Scenario 1 test failed:', err.message);
  process.exit(1);
}
