const readline = require("readline");
const { goodDay } = require("../javascript/good_day_name.js");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer));
  });
}

async function main() {
  const [, , firstArg, lastArg] = process.argv;

  try {
    if (firstArg && lastArg) {
      console.log(goodDay(firstArg, lastArg));
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

