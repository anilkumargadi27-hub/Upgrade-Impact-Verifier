function log(msg) {
  console.log('[LOG]', msg);
}

function debug(msg) {
  console.debug('[DEBUG]', msg);
}

module.exports = {
  log,
  debug
};
