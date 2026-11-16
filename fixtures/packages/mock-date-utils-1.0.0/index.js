function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function parseDate(s) {
  return new Date(s);
}

function unusedHelper() {
  return 'unused-helper-v1';
}

module.exports = {
  formatDate,
  parseDate,
  unusedHelper
};
