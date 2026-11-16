function calculateTax(amount, rate, countryCode) {
  if (rate === undefined || countryCode === undefined) {
    throw new Error('calculateTax requires amount, rate, and countryCode in v2.0.0');
  }
  return amount * (1 + rate);
}

module.exports = {
  calculateTax
};
