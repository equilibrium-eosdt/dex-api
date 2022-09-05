import BigNumber from "bignumber.js";

import { Direction } from "./types";

// Whitelist of tokens
export const TOKENS = [
  "WBTC",
  "ETH",
  "GENS",
  "EQD",
  "BNB",
  "KSM",
  "DOT",
  "EQ",
  "GLMR",
  "ACA",
  "ASTR",
  "INTR",
  "BTC",
  "USDT",
  "USDC",
  "FRAX",
  "XOR",
  "LDO",
];

export const DIRECTIONS = [Direction.Buy, Direction.Sell];
export const AMOUNT_PRECISION = new BigNumber(1e9);
export const PRICE_PRECISION = new BigNumber(1e9);
export const TRANSFER_PRECISION = new BigNumber(1e9);
export const BIG_ZERO = new BigNumber(0);
export const BIG_ONE = new BigNumber(1);
export const EQD_PRICE = "1000000000";
export const ADDRESS_LENGTH_MIN = 48;
export const ADDRESS_LENGTH_MAX = 49;

export const CHAIN_NODE = process.env.CHAIN_NODE || "wss://devnet.genshiro.io";
export const API_ENDPOINT =
  process.env.API_ENDPOINT || "https://apiv3.equilibrium.io/api";
export const PORT = process.env.PORT || 3000;
export const PURGE_TIMEOUT = process.env.PURGE_TIMEOUT || undefined;

console.assert(
  Boolean(process.env.CHAIN_NODE),
  `Env var CHAIN_NODE not found. Using default ${CHAIN_NODE}`
);
console.assert(
  Boolean(process.env.API_ENDPOINT),
  `Env var API_ENDPOINT not found. Using default ${API_ENDPOINT}`
);
console.assert(
  Boolean(process.env.PORT),
  `Env var PORT not found. Using default ${PORT}`
);
