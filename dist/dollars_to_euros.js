"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dollarsToEuros = dollarsToEuros;
var readline = require("readline");
/**
 * Convert an amount from US dollars to euros.
 *
 * @param dollars - Amount in US dollars.
 * @param rate - Conversion rate (1 euro = rate dollars). Default is 1.08.
 * @returns Equivalent amount in euros.
 */
function dollarsToEuros(dollars, rate) {
    if (rate === void 0) { rate = 1.08; }
    if (typeof dollars !== "number" || Number.isNaN(dollars)) {
        throw new Error("`dollars` must be a valid number.");
    }
    if (typeof rate !== "number" || Number.isNaN(rate)) {
        throw new Error("`rate` must be a valid number.");
    }
    return dollars / rate;
}
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
rl.question("Enter amount in US dollars: ", function (answer) {
    var dollars = Number(answer);
    if (Number.isNaN(dollars)) {
        console.error("Please enter a valid number.");
    }
    else {
        var euros = dollarsToEuros(dollars);
        console.log("".concat(dollars, " USD is approximately ").concat(euros.toFixed(2), " EUR."));
    }
    rl.close();
});
