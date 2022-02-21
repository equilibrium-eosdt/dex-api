import { assetFromToken, getApiCreator } from "@equilab/api";
import { switchMap, Observable, catchError, of, filter } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import fetch from "node-fetch";
import qs from "querystring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import Keyring from "@polkadot/keyring";
import fs from "fs";

import { isChainInfoResponse, isSeedPhrases } from "./types";
import {
	API_ENDPOINT,
	CHAIN_NODE,
	PRICE_PRECISION,
	AMOUNT_PRECISION,
	TRANSFER_PRECISION,
} from "./constants";
import { promisify, handleTx, getMessageId, getError } from "./utils";

const api$ = getApiCreator("Gens", "rxjs")(CHAIN_NODE);
let chainId: number | undefined = undefined;
let keyring: Keyring | undefined = undefined;
const orderObservables = new Map<string, Observable<unknown>>();
const bestPricesObservables = new Map<string, Observable<unknown>>();
const messages = new Map<
	string,
	{ success: boolean; pending: boolean; payload: unknown }
>();
const nonces = new Map<string, number>();

const SEED_PHRASES = JSON.parse(fs.readFileSync("./seeds.json", "utf-8"));

if (!isSeedPhrases(SEED_PHRASES)) {
	console.error("Failed to initialize seed phrases from config");
	process.exit();
}

console.info("Initializing keyring...");
cryptoWaitReady()
	.then(() => {
		keyring = new Keyring();
		SEED_PHRASES.forEach((seed) =>
			keyring!.addFromMnemonic(seed, {}, "sr25519")
		);

		console.info("Keyring initialized");

		keyring.pairs.forEach((pair) => {
			const subscription = api$
				.pipe(switchMap((api) => api._api.query.system.account(pair.address)))
				.subscribe({
					next: (acc) => {
						nonces.set(pair.address, acc.nonce.toNumber());
						console.info(
							`Address added ${pair.address} with nonce ${acc.nonce.toNumber()}`
						);
						subscription.unsubscribe();
					},
				});
		});
	})
	.catch((e) => {
		console.error("Failed to initialize keyring. Shutting down", e);
		process.exit();
	});

const genesis$ = api$.pipe(
	switchMap((api) => api.getBlockHash(0)),
	switchMap((hash) =>
		fromFetch(`${API_ENDPOINT}/chains/byHash?hash=${hash.toHex()}`).pipe(
			switchMap((response) => {
				if (response.ok) {
					return response.json();
				} else {
					return of(getError(`Error ${response.status}`));
				}
			}),
			catchError((err) => {
				return of(getError(err.message));
			})
		)
	)
);

const genesisSubscription = genesis$.subscribe({
	next: (res) => {
		if (!isChainInfoResponse(res)) return;

		chainId = res.chainId;

		console.info("Chain id initialized: ", chainId);
		genesisSubscription.unsubscribe();
	},
});

const getOrders$ = (token: string): Observable<unknown> => {
	if (orderObservables.has(token)) {
		return orderObservables.get(token)!;
	}

	const order$ = api$.pipe(switchMap((api) => api.derive.dex.orders(token)));
	orderObservables.set(token, order$);

	return order$;
};

export const getOrders = (token: string) => promisify(getOrders$(token));

const getBestPrices$ = (token: string): Observable<unknown> => {
	if (bestPricesObservables.has(token)) {
		return bestPricesObservables.get(token)!;
	}

	const bestPrices$ = api$.pipe(
		switchMap((api) => api.derive.dex.bestPrice(token))
	);

	bestPricesObservables.set(token, bestPrices$);

	return bestPrices$;
};

export const getBestPrices = (token: string) =>
	promisify(getBestPrices$(token));

export const getTrades = async (
	currency: string,
	acc: string | undefined = undefined,
	page: number = 0,
	pageSize: number = 100
) => {
	if (!chainId) return undefined;

	const url = `${API_ENDPOINT}/dex/exchanges?${qs.stringify({
		acc,
		chainId,
		currency,
		page,
		pageSize,
	})}`;

	const response = await fetch(url);

	return await response.json();
};

export const getBalances = async (token: string, address: string) => {
	const masterBalanceAsset = assetFromToken(token);

	const masterBalance = await promisify(
		api$.pipe(
			switchMap((api) =>
				// @ts-expect-error
				api._api.query.eqBalances.account(address, masterBalanceAsset)
			)
		)
	);

	const tradingBalance = await promisify(
		api$.pipe(
			switchMap((api) =>
				api._api.query.subaccounts.subaccount(address, "Borrower").pipe(
					switchMap((acc) => {
						const addr = acc.unwrapOr(undefined)?.toString();

						if (!addr) return of(undefined);

						return api._api.query.eqBalances.account(
							addr,
							// @ts-expect-error
							masterBalanceAsset
						);
					})
				)
			)
		)
	);

	return { masterBalance, tradingBalance };
};

export const deposit = ({
	token,
	address,
	amount,
}: {
	token: string;
	address: string;
	amount: number | string;
}) => {
	const depositAsset = assetFromToken(token);
	const depositAmount = TRANSFER_PRECISION.times(amount).toString();

	const depositPair = keyring?.getPair(address);

	if (!depositPair) return getError("Address not found in keyring");

	const currentNonce = nonces.get(address);
	if (!currentNonce) return getError("Nonce not found in keyring");

	nonces.set(address, currentNonce + 1);

	const deposit$ = api$.pipe(
		switchMap((api) =>
			api.tx
				.toSubaccount("Borrower", depositAsset, depositAmount)
				.signAndSend(depositPair, { nonce: currentNonce })
				.pipe(
					filter((res) => res.isFinalized || res.isInBlock),
					handleTx(api._api)
				)
		)
	);

	return promisify(deposit$);
};

export const withdraw = ({
	token,
	address,
	amount,
}: {
	token: string;
	address: string;
	amount: number | string;
}) => {
	const withdrawAsset = assetFromToken(token);
	const withdrawAmount = TRANSFER_PRECISION.times(amount).toString();

	const withdrawPair = keyring?.getPair(address);

	if (!withdrawPair) return getError("Address not found in keyring");

	const currentNonce = nonces.get(address);
	if (!currentNonce) return getError("Nonce not found in keyring");

	nonces.set(address, currentNonce + 1);

	const withdraw$ = api$.pipe(
		switchMap((api) =>
			api.tx
				.fromSubaccount("Borrower", withdrawAsset, withdrawAmount)
				.signAndSend(withdrawPair, { nonce: currentNonce })
				.pipe(
					filter((res) => res.isFinalized || res.isInBlock),
					handleTx(api._api)
				)
		)
	);

	return promisify(withdraw$);
};

export const createLimitOrder = ({
	token,
	amount,
	limitPrice,
	direction,
	address,
	tip,
	nonce,
}: {
	token: string;
	amount: number | string;
	limitPrice: number | string;
	direction: "Buy" | "Sell";
	address: string;
	tip?: number;
	nonce?: number;
}) => {
	const createOrderAsset = assetFromToken(token);
	const createOrderLimitPrice = PRICE_PRECISION.times(limitPrice).toString();
	const createOrderDirection = direction;
	const createOrderAmount = AMOUNT_PRECISION.times(amount).toString();

	const pair = keyring?.getPair(address);

	if (!pair) return getError("Address not found in keyring");

	const currentNonce = nonce ?? nonces.get(address);
	if (typeof currentNonce === "undefined")
		return getError("Nonce not found in keyring");

	typeof nonce === "undefined" && nonces.set(address, currentNonce + 1);

	const createOrder$ = api$.pipe(
		switchMap((api) =>
			api.tx
				.dexCreateOrder(
					createOrderAsset,
					{ Limit: { price: createOrderLimitPrice, expiration_time: 0 } },
					createOrderDirection,
					createOrderAmount
				)
				.signAndSend(pair, {
					nonce: currentNonce,
					tip: tip ?? 0,
				})
				.pipe(
					filter((res) => {
						return res.isFinalized || res.isInBlock;
					}),
					handleTx(api._api)
				)
		)
	);

	const messageId = getMessageId();
	const payload = {
		message: "Limit order is creating",
		messageId,
		nonce: currentNonce,
		tip: tip ?? 0,
	};

	messages.set(messageId, {
		success: false,
		pending: true,
		payload,
	});

	const subscription = createOrder$.subscribe({
		next: (payload) => {
			messages.set(messageId, { success: true, pending: false, payload });
			subscription.unsubscribe();
		},
		error: (error) => {
			messages.set(messageId, {
				success: false,
				pending: false,
				payload: { error },
			});
			subscription.unsubscribe();
		},
	});

	return {
		success: true,
		payload,
	};
};

export const updateLimitOrder = async ({
	messageId,
	token,
	amountNew,
	limitPrice,
	limitPriceNew,
	direction,
	address,
	tip,
	nonce,
}: {
	messageId: string;
	token: string;
	amountNew: number;
	limitPrice: number;
	limitPriceNew: number;
	direction: "Buy" | "Sell";
	address: string;
	tip: number;
	nonce?: number;
}) => {
	const orderState = getMessage(messageId);

	console.log("orderState:::", orderState);

	if (
		// Order is already registered on chain
		orderState.success &&
		!orderState.pending &&
		Array.isArray(orderState.payload) &&
		orderState.payload.length > 0
	) {
		const event = orderState.payload[0];
		const { orderId } = event;

		if (!orderId) return getError("Order id is missing");

		try {
			await cancelLimitOrder({
				token,
				price: limitPrice,
				orderId,
				address,
			});

			if (limitPriceNew === 0 || amountNew === 0)
				return {
					success: true,
					pending: false,
					payload: { message: "Order cancelled on chain" },
				};

			return await createLimitOrder({
				token,
				amount: amountNew,
				limitPrice: limitPriceNew,
				direction,
				address,
			});
		} catch (e) {
			return getError((e as Error).toString());
		}
	}

	// Order is waiting for block
	if (!orderState.success && orderState.pending) {
		if (limitPriceNew === 0 || amountNew === 0) {
			const pair = keyring?.getPair(address);

			if (!pair || !nonce || !tip)
				return getError(
					"Address, tip and nonce required to cancel order in block"
				);

			const cancelOrder$ = api$.pipe(
				switchMap((api) =>
					api._api.tx.system
						.remark(`cancel order ${messageId}`)
						.signAndSend(pair, { nonce })
						.pipe(
							filter((res) => {
								return res.isFinalized || res.isInBlock;
							}),
							handleTx(api._api)
						)
				)
			);

			const cancelOrderSubscription = cancelOrder$.subscribe({
				next: () => {
					messages.set(messageId, {
						success: true,
						pending: false,
						payload: { message: "Order cancelled in block" },
					});
					cancelOrderSubscription.unsubscribe();
				},
				error: (error) => {
					messages.set(messageId, {
						success: false,
						pending: false,
						payload: { error },
					});
					cancelOrderSubscription.unsubscribe();
				},
			});

			return {
				success: true,
				pending: true,
				payload: {
					message: "Limit order is cancelling in block",
					messageId,
					nonce,
					tip,
				},
			};
		}

		return await createLimitOrder({
			token,
			amount: amountNew,
			limitPrice: limitPriceNew,
			direction,
			address,
			nonce,
			tip,
		});
	}

	return getError("Order not found");
};

export const cancelLimitOrder = ({
	token,
	price,
	orderId,
	address,
}: {
	token: string;
	price: number;
	orderId: number;
	address: string;
}) => {
	const cancelOrderAsset = assetFromToken(token);
	const cancelOrderPrice = PRICE_PRECISION.times(price).toString();
	const cancelOrderPair = keyring?.getPair(address);

	if (!cancelOrderPair) return getError("Address not found in keyring");

	const currentNonce = nonces.get(address);
	if (typeof currentNonce === "undefined")
		return getError("Nonce not found in keyring");

	nonces.set(address, currentNonce + 1);

	const cancelOrder$ = api$.pipe(
		switchMap((api) =>
			api._api.tx.eqDex
				.deleteOrderExternal(cancelOrderAsset, orderId, cancelOrderPrice)
				.signAndSend(cancelOrderPair, { nonce: currentNonce })
				.pipe(
					filter((res) => res.isFinalized || res.isInBlock),
					handleTx(api._api)
				)
		)
	);

	return promisify(cancelOrder$);
};

export const createMarketOrder = ({
	token,
	amount,
	direction,
	address,
}: {
	token: string;
	amount: number | string;
	direction: "Buy" | "Sell";
	address: string;
}) => {
	const createOrderAsset = assetFromToken(token);
	const createOrderDirection = direction;
	const createOrderAmount = AMOUNT_PRECISION.times(amount).toString();

	const pair = keyring?.getPair(address);

	if (!pair) return getError("Address not found in keyring");

	const currentNonce = nonces.get(address);
	if (!currentNonce) return getError("Nonce not found in keyring");

	nonces.set(address, currentNonce + 1);

	const createOrder$ = api$.pipe(
		switchMap((api) =>
			api.tx
				.dexCreateOrder(
					createOrderAsset,
					{ Market: {} },
					createOrderDirection,
					createOrderAmount
				)
				.signAndSend(pair, {
					nonce: currentNonce,
				})
				.pipe(
					filter((res) => res.isFinalized || res.isInBlock),
					handleTx(api._api)
				)
		)
	);

	const messageId = getMessageId();
	messages.set(messageId, {
		success: false,
		pending: true,
		payload: { message: "Order is creating" },
	});

	const subscription = createOrder$.subscribe({
		next: (payload) => {
			messages.set(messageId, { success: true, pending: false, payload });
			subscription.unsubscribe();
		},
		error: (error) => {
			messages.set(messageId, {
				success: false,
				pending: false,
				payload: { error },
			});
			subscription.unsubscribe();
		},
	});

	return { success: true, payload: { messageId } };
};

export const getMessage = (messageId: string) => {
	if (!messages.has(messageId)) return getError("Message not found");
	return { ...messages.get(messageId) };
};
