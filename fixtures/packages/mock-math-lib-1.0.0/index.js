function calculateTax(amount, rate = 0.05) {
  return amount * (1 + rate);
}

module.exports = {
  calculateTax
};
