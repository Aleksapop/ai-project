"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.euroToDollars = euroToDollars;
/**
 * Convert an amount from euros to US dollars.
 *
 * @param euros - Amount in euros.
 * @param rate - Conversion rate (1 euro = rate dollars). Default is 1.08.
 * @returns Equivalent amount in US dollars.
 */
function euroToDollars(euros, rate = 1.08) {
    if (typeof euros !== "number" || Number.isNaN(euros)) {
        throw new Error("`euros` must be a valid number.");
    }
    if (typeof rate !== "number" || Number.isNaN(rate)) {
        throw new Error("`rate` must be a valid number.");
    }
    return euros * rate;
}
