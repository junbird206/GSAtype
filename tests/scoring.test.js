import assert from "node:assert/strict";
import { QUESTIONS, TYPES } from "../src/data.js";
import { calculateResult } from "../src/scoring.js";

const allA = calculateResult([0, 0, 0, 0, 0, 0, 0, 0], QUESTIONS, TYPES);
assert.equal(allA.type.id, "white");
assert.equal(allA.totals.white, 9);

const allB = calculateResult([1, 1, 1, 1, 1, 1, 1, 1], QUESTIONS, TYPES);
assert.equal(allB.type.id, "cheer");

const tieEarlierQuestion = calculateResult(
  [0, 1],
  [
    {
      options: [
        { scores: { white: 2 } },
        { scores: { eng: 2 } }
      ]
    },
    {
      options: [
        { scores: { white: 2 } },
        { scores: { eng: 2 } }
      ]
    }
  ],
  TYPES
);
assert.equal(tieEarlierQuestion.totals.white, tieEarlierQuestion.totals.eng);
assert.equal(tieEarlierQuestion.type.id, "white");

const tieArrayOrder = calculateResult([], QUESTIONS, TYPES);
assert.equal(tieArrayOrder.type.id, "white");

console.log("scoring tests passed");
