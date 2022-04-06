import { assetFromToken, getApiCreatorRx, tokenFromAsset } from "@equilab/api";
import { currencyFromU64 } from "@equilab/api/genshiro";
import { Vec } from "@polkadot/types-codec";
import { Order } from "@equilab/api/genshiro/interfaces";
import BigNumber from "bignumber.js";
import {
  switchMap,
  Observable,
  catchError,
  of,
  filter,
  map,
  tap,
  combineLatestWith,
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
} from "./types";
import {
  API_ENDPOINT,
  CHAIN_NODE,
  PRICE_PRECISION,
  AMOUNT_PRECISION,
  TRANSFER_PRECISION,
  BIG_ZERO,
  EQD_PRICE,
  BIG_ONE,
} from "./constants";
import {
  promisify,
  handleTx,
  getMessageId,
  getError,
  capitalize,
  priceToBn,
} from "./utils";
import {
  AccountInfo,
  PricePoint,
  SignedBalance,
} from "@equilab/api/genshiro/interfaces";

const api$ = getApiCreatorRx("Gens")(CHAIN_NODE);
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
    keyring = new Keyring({ ss58Format: 67 });
    SEED_PHRASES.forEach((seed) =>
      keyring!.addFromMnemonic(seed, {}, "sr25519")
    );

    console.info("Keyring initialized");

    keyring.pairs.forEach((pair) => {
      const subscription = api$
        .pipe(
          switchMap((api) =>
            api._api.query.system.account<AccountInfo>(pair.address)
          )
        )
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

const getBorrowerAddress$ = (address: string) =>
  api$.pipe(
    switchMap((api) =>
      api.query
        .getAddress(address, "Borrower")
        .pipe(map((acc) => acc.unwrapOr(undefined)?.toString()))
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

  const orders$ = api$.pipe(switchMap((api) => api.derive.dex.orders(token)));
  orderObservables.set(token, orders$);

  return orders$;
};

export const getOrders = (token: string) => promisify(getOrders$(token));

const getOrdersByAddress$ = (token: string, address: string) =>
  getOrders$(token).pipe(
    combineLatestWith(getBorrowerAddress$(address)),
    map(([orders, borrowerAddress]) => {
      return (orders as { account: string }[]).filter(
        ({ account }) => account === borrowerAddress
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

export const getBalances = async (token: string, address: string) => {
  const masterBalanceAsset = assetFromToken(token);

  const masterBalance = await promisify(
    api$.pipe(
      switchMap((api) => api.query.getBalance(address, masterBalanceAsset)),
      map((res) =>
        res.isPositive
          ? res.asPositive.toString()
          : "-" + res.asNegative.toString()
      )
    )
  );

  const tradingBalance = await promisify(
    api$.pipe(
      switchMap((api) =>
        api.query.getAddress(address, "Borrower").pipe(
          switchMap((acc) => {
            const addr = acc.unwrapOr(undefined)?.toString();

            if (!addr) return of(undefined);

            return api.query.getBalance(addr, masterBalanceAsset);
          }),
          map((res) => {
            if (!res) return "0";
            return res.isPositive
              ? res.asPositive.toString()
              : "-" + res.asNegative.toString();
          })
        )
      )
    )
  );

  return {
    masterBalance,
    tradingBalance,
  };
};

const assetInfo$ = api$.pipe(
  switchMap((api) => api.query.assetInfo()),
  map((raw) =>
    raw.unwrap().map((asset) => ({
      token: currencyFromU64(asset.id[0].toNumber()),
      asset: asset.id[0].toNumber(),
    }))
  )
);

const getBalances$ = (address: string) =>
  api$.pipe(
    combineLatestWith(assetInfo$, getBorrowerAddress$(address)),
    switchMap(([api, assetInfo, borrowerAddress]) =>
      borrowerAddress
        ? api.query.getBalance
            .multi<SignedBalance>(
              assetInfo.map(({ asset }) => [borrowerAddress, { 0: asset }])
            )
            .pipe(
              map((balances) =>
                balances.map((balance, i) => ({
                  balance: priceToBn(balance),
                  ...assetInfo[i],
                }))
              )
            )
        : of([])
    )
  );

const rates$ = api$.pipe(
  combineLatestWith(assetInfo$),
  switchMap(([api, assetInfo]) =>
    api.query.getRate
      .multi<PricePoint>(assetInfo.map(({ asset }) => [asset]))
      .pipe(
        map((rates) =>
          rates.map(({ price }, i) => ({
            price: priceToBn(
              assetInfo[i].token === "Eqd" ? EQD_PRICE : price.toString(10)
            ),
            ...assetInfo[i],
          }))
        )
      )
  )
);

export const getRates = () => promisify(rates$);

const getBalancesWithUsd$ = (address: string) =>
  getBalances$(address).pipe(
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
    switchMap((api) => api._api.query.eqDex.ordersByAssetAndChunkKey.entries()),
    combineLatestWith(getBorrowerAddress$(address)),
    map(([orders, borrowerAddress]) =>
      orders
        .flatMap(([, order]) => (order as unknown as Vec<Order>).toArray())
        .filter(({ account_id }) => account_id.toString() === borrowerAddress)
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
  const depositAsset = assetFromToken(token);
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
  const depositAsset = assetFromToken(token);
  const depositAmount = TRANSFER_PRECISION.times(amount).toString(10);

  const depositPair = keyring?.getPair(address);

  if (!depositPair) return getError("Address not found in keyring");

  const currentNonce = nonces.get(address);

  if (typeof currentNonce === "undefined")
    return getError("Nonce not found in keyring");

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
  const withdrawAmount = TRANSFER_PRECISION.times(amount).toString(10);

  const withdrawPair = keyring?.getPair(address);

  if (!withdrawPair) return getError("Address not found in keyring");

  const currentNonce = nonces.get(address);
  if (typeof currentNonce === "undefined")
    return getError("Nonce not found in keyring");

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
  direction: Direction;
  address: string;
  tip?: number;
  nonce?: number;
}) => {
  const createOrderAsset = assetFromToken(token);
  const createOrderLimitPrice = PRICE_PRECISION.times(limitPrice).toString(10);
  const createOrderDirection = capitalize(direction);
  const createOrderAmount = AMOUNT_PRECISION.times(amount).toString(10);

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
}: {
  token: string;
  price: number;
  orderId: number;
  address: string;
}) => {
  const cancelOrderAsset = assetFromToken(token);
  const cancelOrderPrice = PRICE_PRECISION.times(price).toString(10);
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
  direction: Direction;
  address: string;
}) => {
  const createOrderAsset = assetFromToken(token);
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
