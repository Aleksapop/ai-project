const DOLLAR_TO_EURO_RATE = 0.92; // Adjust this rate as needed.

function convertDollarsToEuros(amountInDollars: number, rate: number = DOLLAR_TO_EURO_RATE): number {
  return amountInDollars * rate;
}

declare function require(name: string): any;
declare const process: any;
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter amount in US dollars: ", (input) => {
  const dollars = parseFloat(input);

  if (isNaN(dollars) || dollars < 0) {
    console.log("Please enter a valid non-negative number.");
  } else {
    const euros = convertDollarsToEuros(dollars);
    console.log(`${dollars.toFixed(2)} USD is approximately ${euros.toFixed(2)} EUR.`);
  }

  rl.close();
});

