import BigNumber from "bignumber.js";

export const AMOUNT_PRECISION = new BigNumber(1e18);
export const PRICE_PRECISION = new BigNumber(1e9);
export const TRANSFER_PRECISION = new BigNumber(1e9);

export const CHAIN_NODE = process.env.CHAIN_NODE || "wss://devnet.genshiro.io";
export const API_ENDPOINT =
	process.env.API_ENDPOINT || "https://apiv3.equilibrium.io/api";
export const PORT = process.env.PORT || 3000;

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
