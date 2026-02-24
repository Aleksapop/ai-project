// euros_to_dollars.ts
import * as readline from "readline";

function euroToDollars(euros: number, rate: number = 1.08): number {
  return euros * rate;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer));
  });
}

async function main() {
  try {
    const eurosInputStr = await askQuestion("Enter amount in euros: ");
    const eurosInput = parseFloat(eurosInputStr);

    if (isNaN(eurosInput)) {
      console.log("Please enter valid numeric values for amount and rate.");
      rl.close();
      return;
    }

    const rateInputStr = await askQuestion(
      "Enter conversion rate (press Enter to use default 1.08): "
    );
    rl.close();

    let rateValue: number;
    if (rateInputStr.trim()) {
      rateValue = parseFloat(rateInputStr);
      if (isNaN(rateValue)) {
        console.log("Please enter valid numeric values for amount and rate.");
        return;
      }
    } else {
      rateValue = 1.08;
    }

    const dollars = euroToDollars(eurosInput, rateValue);
    console.log(
      `${eurosInput} EUR = ${dollars.toFixed(2)} USD (rate: ${rateValue})`
    );
  } catch {
    console.log("Please enter valid numeric values for amount and rate.");
  }
}

main();