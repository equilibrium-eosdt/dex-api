import "@equilab/api/equilibrium/interfaces/augment-api";
import "@equilab/api/equilibrium/interfaces/types-lookup";

import type { Option } from "@polkadot/types";
import type { Codec } from "@polkadot/types/types";
import type BN from "bn.js";
import { getApiCreatorRx } from "@equilab/api";
import {
  u64FromCurrency,
  currencyFromU64,
} from "@equilab/api/equilibrium/util";
import { Vec } from "@polkadot/types-codec";
import BigNumber from "bignumber.js";
import type {
  EqPrimitivesDexOrder,
  EqOraclePricePoint,
} from "@polkadot/types/lookup";

import {
  switchMap,
  Observable,
  catchError,
  of,
  filter,
  map,
  combineLatestWith,
  firstValueFrom,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";
import fetch from "node-fetch";
import qs from "querystring";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import Keyring from "@polkadot/keyring";
import fs from "fs";

import {
  isChainInfoResponse,
  isSeedPhrases,
  isCreateOrderExtrinsic,
  Direction,
  isOrderLikeArray,
} from "./types";
import {
  API_ENDPOINT,
  CHAIN_NODE,
  PRICE_PRECISION,
  AMOUNT_PRECISION,
  TRANSFER_PRECISION,
  BIG_ZERO,
  EQD_PRICE,
  PURGE_TIMEOUT,
} from "./constants";
import {
  promisify,
  handleTx,
  getMessageId,
  getError,
  capitalize,
  priceToBn,
  isPosInt,
} from "./utils";

const unwrap = <T extends Codec>(opt: undefined | Option<T>): undefined | T =>
  opt && !opt.isNone.valueOf() ? opt.unwrap() : undefined;

const api$ = getApiCreatorRx("Eq")(CHAIN_NODE);

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
    keyring = new Keyring({ ss58Format: 68 });
    SEED_PHRASES.forEach((seed) =>
      keyring!.addFromMnemonic(seed, {}, "sr25519")
    );

    console.info("Keyring initialized");

    keyring.pairs.forEach((pair) => {
      const subscription = api$
        .pipe(switchMap((api) => api._api.query.system.account(pair.address)))
        .subscribe({
          next: (acc) => {
            nonces.set(
              pair.address,
              (acc as unknown as { nonce: BN }).nonce.toNumber()
            );
            console.info(
              `Address added ${pair.address} with nonce ${(
                acc as unknown as { nonce: BN }
              ).nonce.toNumber()}`
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

const getTraderAddress$ = (address: string) =>
  api$.pipe(
    switchMap((api) =>
      api.query
        .getAddress(address, "Trader")
        .pipe(map((acc) => acc.unwrapOr(undefined)?.toString()))
    )
  );

export const getTraderAddress = (address: string) =>
  promisify(getTraderAddress$(address));

const genesisSubscription = genesis$.subscribe({
  next: (res) => {
    if (!isChainInfoResponse(res)) return;

    chainId = res.chainId;

    console.info("Chain id initialized: ", chainId);
    genesisSubscription.unsubscribe();
  },
});

export const getChainId = () => ({ success: !!chainId, chainId });

const getOrders$ = (token: string): Observable<unknown> => {
  if (orderObservables.has(token)) {
    return orderObservables.get(token)!;
  }

  const orders$ = api$.pipe(switchMap((api) => api.derive.dex.orders(token)));
  orderObservables.set(token, orders$);

  return orders$;
};

export const getOrders = (token: string) => promisify(getOrders$(token));

const getDepth$ = (token: string, depth: string) =>
  getOrders$(token).pipe(
    map((orders) => {
      if (!isOrderLikeArray(orders)) return [];
      const bidOrders = orders.filter((el) => el.side === Direction.Buy);
      const askOrders = orders.filter((el) => el.side === Direction.Sell);

      const bidLevels = bidOrders.reduce(
        (acc: Record<string, BigNumber>, el) => {
          if (el.price in acc) {
            return { ...acc, [el.price]: acc[el.price].plus(el.amount) };
          }
          return { ...acc, [el.price]: new BigNumber(el.amount) };
        },
        {}
      );
      const askLevels = askOrders.reduce(
        (acc: Record<string, BigNumber>, el) => {
          if (el.price in acc) {
            return { ...acc, [el.price]: acc[el.price].plus(el.amount) };
          }
          return { ...acc, [el.price]: new BigNumber(el.amount) };
        },
        {}
      );

      const bids = Object.entries(bidLevels)
        .sort(([a], [b]) => new BigNumber(b).minus(a).toNumber())
        .slice(0, isPosInt(depth) ? +depth : 100);
      const asks = Object.entries(askLevels)
        .sort(([a], [b]) => new BigNumber(a).minus(b).toNumber())
        .slice(0, isPosInt(depth) ? +depth : 100);

      return { bids, asks };
    })
  );

export const getDepth = (token: string, depth: string) =>
  promisify(getDepth$(token, depth));

const getOrdersByAddress$ = (token: string, address: string) =>
  getOrders$(token).pipe(
    combineLatestWith(getTraderAddress$(address)),
    map(([orders, traderAddress]) => {
      return (orders as { account: string }[]).filter(
        ({ account }) => account === traderAddress
      );
    })
  );

export const getOrdersByAddress = (token: string, address: string) => {
  return promisify(getOrdersByAddress$(token, address));
};

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

const getBalancesByAddress$ = (
  address: string
): Observable<
  {
    token: string;
    asset: number;
    balance: BigNumber;
  }[]
> =>
  api$.pipe(
    switchMap((api) => api._api.query.system.account(address)),
    map((res) => {
      if (res.data.isEmpty) {
        return [];
      }

      return res.data.toArray().map(([assetId, balance]) => {
        return {
          token: currencyFromU64(assetId),
          asset: assetId.toNumber(),
          balance: priceToBn(balance),
        };
      });
    })
  );

export const getBalances = async (token: string, address: string) => {
  const masterBalances = await promisify(getBalancesByAddress$(address));

  const tradingBalances = await promisify(
    api$.pipe(
      switchMap((api) =>
        api.query.getAddress(address, "Trader").pipe(
          switchMap((acc) => {
            const addr = acc.unwrapOr(undefined)?.toString();

            if (!addr) {
              return of(undefined);
            }

            return getBalancesByAddress$(addr);
          })
        )
      )
    )
  );

  const masterBalance =
    masterBalances
      .find((el) => el.token.toLowerCase() === token.toLowerCase())
      ?.balance.toString() ?? "0";
  const tradingBalance =
    tradingBalances
      ?.find((el) => el.token.toLowerCase() === token.toLowerCase())
      ?.balance.toString() ?? "0";

  return {
    masterBalance,
    tradingBalance,
  };
};

const assetInfo$ = api$.pipe(
  switchMap((api) => api._api.query.eqAssets.assets()),
  map((raw) =>
    raw.unwrap().map((asset) => ({
      token: currencyFromU64(asset.id.toNumber()),
      asset: asset.id.toNumber(),
    }))
  )
);

const getToken$ = (token: string) =>
  api$.pipe(
    switchMap((api) => api.query.assetInfo()),
    map((raw) =>
      raw
        .unwrap()
        .map((asset) => ({
          token: currencyFromU64(asset.id.toNumber()),
          asset: asset.id.toNumber(),
          lot: new BigNumber(asset.lot.toString(10)).div(AMOUNT_PRECISION),
          priceStep: new BigNumber(asset.priceStep.toString(10)).div(
            AMOUNT_PRECISION
          ),
          makerFee: new BigNumber(asset.makerFee.toString(10)).div(
            AMOUNT_PRECISION
          ),
          takerFee: new BigNumber(asset.takerFee.toString(10)).div(
            AMOUNT_PRECISION
          ),
        }))
        .filter((el) => el.token.toLowerCase() === token.toLowerCase())
    )
  );

export const getToken = (token: string) => promisify(getToken$(token));

const rates$ = api$.pipe(
  combineLatestWith(assetInfo$),
  switchMap(([api, assetInfo]) =>
    api._api.query.oracle.pricePoints
      .multi<Option<EqOraclePricePoint>>(assetInfo.map(({ asset }) => [asset]))
      .pipe(
        map((rates) =>
          rates.map((rate, i) => ({
            price: priceToBn(
              assetInfo[i].token === "eqd"
                ? EQD_PRICE
                : rate.unwrapOr(undefined)?.price.toString(10) ?? "0"
            ),
            ...assetInfo[i],
          }))
        )
      )
  )
);

export const getRates = () => promisify(rates$);

const getBalancesWithUsd$ = (address: string) =>
  getBalancesByAddress$(address).pipe(
    combineLatestWith(rates$),
    map(([balances, rates]) => {
      return balances.map((el) => ({
        ...el,
        price: rates.find(({ token }) => token === el.token)?.price ?? BIG_ZERO,
      }));
    })
  );

const getCollateralDebtTotals$ = (address: string) =>
  getBalancesWithUsd$(address).pipe(
    map((tokenData) => {
      return tokenData.reduce(
        (acc, { price, balance }) => {
          if (balance.gt(0)) {
            return {
              ...acc,
              collateralUsd: acc.collateralUsd.plus(balance.times(price)),
            };
          }
          if (balance.lt(0)) {
            return {
              ...acc,
              debtUsd: acc.debtUsd.plus(balance.times(price).abs()),
            };
          }

          return acc;
        },
        { collateralUsd: BIG_ZERO, debtUsd: BIG_ZERO }
      );
    })
  );

const getLockedBalance$ = (address: string) =>
  api$.pipe(
    // @ts-expect-error
    switchMap((api) => api._api.query.eqDex.ordersByAssetAndChunkKey.entries()),
    combineLatestWith(getTraderAddress$(address)),
    map(([orders, traderAddress]) =>
      orders
        .flatMap(([, order]) =>
          (order as unknown as Vec<EqPrimitivesDexOrder>).toArray()
        )
        .filter((order) => {
          return order.accountId.toString() === traderAddress;
        })
    ),
    map((orders) =>
      orders.reduce((acc, { price, amount }) => {
        return acc.plus(
          new BigNumber(price.toString(10))
            .div(PRICE_PRECISION)
            .times(amount.toString(10))
            .div(AMOUNT_PRECISION)
        );
      }, BIG_ZERO)
    )
  );

const getCollateralDebtLocked$ = (address: string) =>
  getCollateralDebtTotals$(address).pipe(
    combineLatestWith(getLockedBalance$(address)),
    map(([{ collateralUsd, debtUsd }, lockedUsd]) => ({
      collateralUsd,
      debtUsd,
      lockedUsd,
      availableUsd: collateralUsd.minus(debtUsd).minus(lockedUsd),
    }))
  );

export const getLockedBalance = (address: string) =>
  promisify(getCollateralDebtLocked$(address));

const getMargin$ = (address: string) => {
  return getCollateralDebtTotals$(address).pipe(
    map(({ collateralUsd, debtUsd }) =>
      collateralUsd.minus(debtUsd).div(collateralUsd.plus(debtUsd))
    )
  );
};

export const getMargin = (address: string) => promisify(getMargin$(address));

export const sudoDeposit = ({
  token,
  address,
  to,
  amount,
}: {
  token: string;
  address: string;
  to: string;
  amount: number | string;
}) => {
  const depositAsset = u64FromCurrency(token);
  const depositAmount = TRANSFER_PRECISION.times(amount).toString(10);
  const depositPair = keyring?.getPair(address);

  if (!depositPair) return getError("Address not found in keyring");
  const sudoDeposit$ = api$.pipe(
    switchMap((api) =>
      api._api.tx.sudo
        .sudo(api._api.tx.eqBalances.deposit(depositAsset, to, depositAmount))
        .signAndSend(depositPair, { nonce: -1 })
    )
  );

  return promisify(sudoDeposit$);
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
  const depositAsset = u64FromCurrency(token);
  const depositAmount = TRANSFER_PRECISION.times(amount).toString(10);

  const depositPair = keyring?.getPair(address);

  if (!depositPair) return getError("Address not found in keyring");

  const currentNonce = nonces.get(address);

  if (typeof currentNonce === "undefined")
    return getError("Nonce not found in keyring");

  nonces.set(address, currentNonce + 1);

  const deposit$ = api$.pipe(
    switchMap((api) => {
      const ex = api.tx.toSubaccount("Trader", depositAsset, depositAmount);
      return ex.signAndSend(depositPair, { nonce: currentNonce }).pipe(
        filter((res) => res.isFinalized || res.isInBlock),
        handleTx(api._api)
      );
    })
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
  const withdrawAsset = u64FromCurrency(token);
  const withdrawAmount = TRANSFER_PRECISION.times(amount).toString(10);

  const withdrawPair = keyring?.getPair(address);

  if (!withdrawPair) return getError("Address not found in keyring");

  const currentNonce = nonces.get(address);
  if (typeof currentNonce === "undefined")
    return getError("Nonce not found in keyring");

  nonces.set(address, currentNonce + 1);

  const withdraw$ = api$.pipe(
    switchMap((api) => {
      const ex = api.tx.fromSubaccount("Trader", withdrawAsset, withdrawAmount);
      return ex.signAndSend(withdrawPair, { nonce: currentNonce }).pipe(
        filter((res) => res.isFinalized || res.isInBlock),
        handleTx(api._api)
      );
    })
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
  isUsingPool,
}: {
  token: string;
  amount: number | string;
  limitPrice: number | string;
  direction: Direction;
  address: string;
  tip?: number;
  nonce?: number;
  isUsingPool?: boolean;
}) => {
  const createOrderAsset = u64FromCurrency(token);
  const createOrderLimitPrice = PRICE_PRECISION.times(limitPrice).toString(10);
  const createOrderDirection = capitalize(direction) as "Buy" | "Sell";
  const createOrderAmount = AMOUNT_PRECISION.times(amount).toString(10);

  const pair = keyring?.getPair(address);

  if (!pair) return getError("Address not found in keyring");

  const currentNonce = nonce ?? nonces.get(address);
  if (typeof currentNonce === "undefined")
    return getError("Nonce not found in keyring");

  typeof nonce === "undefined" && nonces.set(address, currentNonce + 1);

  const createOrder$ = api$.pipe(
    switchMap((api) => {
      const createOrder = isUsingPool
        ? api._api.tx.eqMarketMaker.createOrder
        : api.tx.dexCreateOrder;
      return createOrder(
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
        );
    })
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
      Number(PURGE_TIMEOUT) > 0 &&
        setTimeout(() => {
          messages.delete(messageId);
        }, Number(PURGE_TIMEOUT) * 1000);
    },
    error: (error) => {
      messages.set(messageId, {
        success: false,
        pending: false,
        payload: { error },
      });
      subscription.unsubscribe();
      Number(PURGE_TIMEOUT) > 0 &&
        setTimeout(() => {
          messages.delete(messageId);
        }, Number(PURGE_TIMEOUT) * 1000);
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
  direction: Direction;
  address: string;
  tip: number;
  nonce?: number;
}) => {
  const orderState = getMessage(messageId);

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
  isUsingPool,
}: {
  token: string;
  price: number;
  orderId: number;
  address: string;
  isUsingPool?: boolean;
}) => {
  const cancelOrderAsset = u64FromCurrency(token);
  const cancelOrderPrice = PRICE_PRECISION.times(price).toString(10);
  const cancelOrderPair = keyring?.getPair(address);

  if (!cancelOrderPair) return getError("Address not found in keyring");

  const currentNonce = nonces.get(address);
  if (typeof currentNonce === "undefined")
    return getError("Nonce not found in keyring");

  nonces.set(address, currentNonce + 1);

  const cancelOrder$ = api$.pipe(
    switchMap((api) => {
      const deleteOrder = isUsingPool
        ? api._api.tx.eqMarketMaker.deleteOrder
        : api.tx.dexDeleteOrder;
      return deleteOrder(cancelOrderAsset, orderId, cancelOrderPrice)
        .signAndSend(cancelOrderPair, { nonce: currentNonce })
        .pipe(
          filter((res) => res.isFinalized || res.isInBlock),
          handleTx(api._api)
        );
    })
  );

  return promisify(cancelOrder$);
};

export const cancelLimitOrders = async ({
  orders,
  address,
  isUsingPool,
}: {
  orders: { token: string; price: number; orderId: number }[];
  address: string;
  isUsingPool?: boolean;
}) => {
  const cancelOrderPair = keyring?.getPair(address);

  if (!cancelOrderPair) return getError("Address not found in keyring");

  const cancelOrders$ = api$.pipe(
    map((api) => {
      const deleteOrder = isUsingPool
        ? api._api.tx.eqMarketMaker.deleteOrder
        : api.tx.dexDeleteOrder;

      return orders.map(({ token, price, orderId }) => {
        const currentNonce = nonces.get(address);
        nonces.set(address, currentNonce! + 1);
        const asset = u64FromCurrency(token);
        const orderPrice = PRICE_PRECISION.times(price).toString(10);
        return deleteOrder(asset, orderId, orderPrice)
          .signAndSend(cancelOrderPair, { nonce: currentNonce })
          .pipe(
            filter((res) => res.isFinalized || res.isInBlock),
            handleTx(api._api)
          );
      });
    })
  );

  const orders$ = await firstValueFrom(cancelOrders$);

  const messageId = getMessageId();
  const payload = {
    message: "Orders are cancelling",
    messageId,
    orders,
    events: [],
  };

  messages.set(messageId, {
    success: true,
    pending: false,
    payload,
  });

  orders$.forEach((order$) => {
    const sub = order$.subscribe({
      next: (payload) => {
        const message = messages.get(messageId);
        const rootPayload: any = message?.payload;
        const nextPayload = {
          ...rootPayload,
          events: [
            ...rootPayload.events,
            { success: true, pending: false, payload },
          ],
        };
        // @ts-expect-error
        messages.set(messageId, { ...message, payload: nextPayload });
        sub.unsubscribe();
      },
      error: (e) => {
        const message = messages.get(messageId);
        const rootPayload: any = message?.payload;
        const nextPayload = {
          ...rootPayload,
          events: [
            ...rootPayload.events,
            { success: false, pending: false, error: e?.toString() },
          ],
        };
        // @ts-expect-error
        messages.set(messageId, { ...message, payload: nextPayload });
        sub.unsubscribe();
      },
    });
  });

  Number(PURGE_TIMEOUT) > 0 &&
    setTimeout(() => {
      messages.delete(messageId);
    }, Number(PURGE_TIMEOUT) * 1000);

  return {
    success: true,
    payload,
  };
};

export const createMarketOrder = ({
  token,
  amount,
  direction,
  address,
}: {
  token: string;
  amount: number | string;
  direction: Direction;
  address: string;
}) => {
  const createOrderAsset = u64FromCurrency(token);
  const createOrderDirection = capitalize(direction);
  const createOrderAmount = AMOUNT_PRECISION.times(amount).toString(10);

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

export const getPendingExtrinsics = async (address: string) => {
  const pendingPair = keyring?.getPair(address);

  if (!pendingPair) return getError("Address not found in keyring");

  const pendingExtrinsics$ = api$.pipe(
    switchMap((api) => api._api.rpc.author.pendingExtrinsics()),
    map((extrinsics) => {
      const filtered = extrinsics
        .map((extrinsic) => extrinsic.toHuman())
        .filter((el) => {
          if (!isCreateOrderExtrinsic(el)) return false;

          return el.signer === address;
        });

      return filtered;
    })
  );

  return await promisify(pendingExtrinsics$);
};
