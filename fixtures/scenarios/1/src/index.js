const { formatDate } = require('mock-date-utils');

function renderReportDate(d) {
  return `Report Date: ${formatDate(d)}`;
}

module.exports = { renderReportDate };
