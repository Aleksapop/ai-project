/**
 * Convert an amount from euros to US dollars.
 *
 * @param {number} euros - Amount in euros.
 * @param {number} [rate=1.08] - Conversion rate (1 euro = rate dollars). Default is 1.08.
 * @returns {number} Equivalent amount in US dollars.
 */
function euroToDollars(euros, rate = 1.08) {
  if (typeof euros !== "number" || isNaN(euros)) {
    throw new Error("`euros` must be a valid number.");
  }
  if (typeof rate !== "number" || isNaN(rate)) {
    throw new Error("`rate` must be a valid number.");
  }
  return euros * rate;
}

// If run directly with Node, allow simple CLI usage:
if (require.main === module) {
  const readline = require("readline");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter amount in euros: ", (eurosInput) => {
    rl.question(
      "Enter conversion rate (press Enter to use default 1.08): ",
      (rateInput) => {
        try {
          const euros = parseFloat(eurosInput);
          const rate = rateInput.trim() ? parseFloat(rateInput) : 1.08;

          if (isNaN(euros) || isNaN(rate)) {
            throw new Error("Please enter valid numeric values for amount and rate.");
          }

          const dollars = euroToDollars(euros, rate);
          console.log(
            `${euros} EUR = ${dollars.toFixed(2)} USD (rate: ${rate})`
          );
        } catch (err) {
          console.error(err.message);
        } finally {
          rl.close();
        }
      }
    );
  });
}

module.exports = { euroToDollars };

