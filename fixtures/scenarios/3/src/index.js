const { log } = require('mock-logger');

function doWork() {
  log('Starting work');
  return 'done';
}

module.exports = { doWork };
