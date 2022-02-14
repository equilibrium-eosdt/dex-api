import type { RegistryError } from "@polkadot/types/types";

export interface ChainInfoResponse {
	chainId: number;
	genesisHash: string;
}

export interface ExchangesResponseItem {
	id: number;
	chainId: number;
	currency: string;
	price: number;
	amount: number;
	makerAccountId: string;
	takerAccountId: string;
	makerSide: string;
	blockNumber: number;
	takerFee: number;
	makerFee: number;
}

export class TxError extends Error {
	public registryErrors: RegistryError[];

	constructor(message: string, errors: RegistryError[]) {
		super(message);
		this.registryErrors = errors;
	}
}

export const isChainInfoResponse = (raw: unknown): raw is ChainInfoResponse =>
	typeof (raw as ChainInfoResponse).chainId === "number" &&
	typeof (raw as ChainInfoResponse).genesisHash === "string";

export const isSeedPhrases = (raw: unknown): raw is string[] =>
	Array.isArray(raw) &&
	raw.every((el) => typeof el === "string" && el.split(" ").length === 12);
