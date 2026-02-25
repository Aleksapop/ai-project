const readline = require("readline");

function pozdrav(name, surname) {
  console.log(`Dobar dan, ${surname} ${name}`);
}

function validiraj(text, polje) {
  if (text.length < 3) {
    console.log(`Greška: ${polje} mora imati najmanje 3 slova.`);
    return false;
  }
  if (/^\d+$/.test(text)) {
    console.log(`Greška: ${polje} ne sme biti broj.`);
    return false;
  }
  return true;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

(async () => {
  let name, surname;
  while (true) {
    name = await ask("Unesi ime: ");
    surname = await ask("Unesi prezime: ");
    if (validiraj(name, "Ime") && validiraj(surname, "Prezime")) {
      break;
    }
    console.log("Pokušaj ponovo.\n");
  }
  pozdrav(name, surname);
  rl.close();
})();
