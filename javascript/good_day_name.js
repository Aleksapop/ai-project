/**
 * Format a "Good day" greeting using last name then first name.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string}
 */
function goodDay(firstName, lastName) {
  if (typeof firstName !== "string" || !firstName.trim()) {
    throw new Error("`firstName` must be a non-empty string.");
  }
  if (typeof lastName !== "string" || !lastName.trim()) {
    throw new Error("`lastName` must be a non-empty string.");
  }

  const first = firstName.trim();
  const last = lastName.trim();
  return `Good day ${last} ${first}`;
}

// If run directly with Node, allow simple CLI usage:
// node javascript/good_day_name.js Jane Doe
if (require.main === module) {
  const [, , firstArg, lastArg] = process.argv;

  if (firstArg && lastArg) {
    try {
      console.log(goodDay(firstArg, lastArg));
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1;
    }
  } else {
    const readline = require("readline");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Enter first name: ", (firstName) => {
      rl.question("Enter last name: ", (lastName) => {
        try {
          console.log(goodDay(firstName, lastName));
        } catch (err) {
          console.error(err.message);
          process.exitCode = 1;
        } finally {
          rl.close();
        }
      });
    });
  }
}

module.exports = { goodDay };

