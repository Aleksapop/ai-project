import * as readline from "readline";

/**
 * Convert an amount from US dollars to euros.
 *
 * @param dollars - Amount in US dollars.
 * @param rate - Conversion rate (1 euro = rate dollars). Default is 1.08.
 * @returns Equivalent amount in euros.
 */
export function dollarsToEuros(dollars: number, rate: number = 1.08): number {
  if (typeof dollars !== "number" || Number.isNaN(dollars)) {
    throw new Error("`dollars` must be a valid number.");
  }
  if (typeof rate !== "number" || Number.isNaN(rate)) {
    throw new Error("`rate` must be a valid number.");
  }

  return dollars / rate;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter amount in US dollars: ", (answer) => {
  const dollars = Number(answer);

  if (Number.isNaN(dollars)) {
    console.error("Please enter a valid number.");
  } else {
    const euros = dollarsToEuros(dollars);
    console.log(`${dollars} USD is approximately ${euros.toFixed(2)} EUR.`);
  }

  rl.close();
});
