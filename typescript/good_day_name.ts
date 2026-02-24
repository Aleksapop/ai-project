import * as readline from "readline";

export function goodDay(firstName: string, lastName: string): string {
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
  const [, , firstArg, lastArg] = process.argv;

  try {
    if (firstArg && lastArg) {
      console.log(goodDay(firstArg, lastArg));
      rl.close();
      return;
    }

    const firstInput = await askQuestion("Enter first name: ");
    const lastInput = await askQuestion("Enter last name: ");
    console.log(goodDay(firstInput, lastInput));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
