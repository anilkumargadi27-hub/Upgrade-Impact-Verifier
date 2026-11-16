// Note: We only import parseDate. We NEVER import formatDate or unusedHelper.
const { parseDate } = require('mock-date-utils');

function getEpochFromDateString(str) {
  const d = parseDate(str);
  return d.getTime();
}

module.exports = { getEpochFromDateString };
