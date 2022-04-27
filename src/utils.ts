import BigNumber from "bignumber.js";
import { Observable, map } from "rxjs";
import type { ApiRx } from "@polkadot/api";
import type { IEvent, ISubmittableResult } from "@polkadot/types/types";
import type { DispatchInfo, DispatchError } from "@polkadot/types/interfaces";

import { TxError } from "./types";
import { PRICE_PRECISION, BIG_ZERO } from "./constants";

let nonce = 0;

export const getMessageId = () => {
  nonce = nonce + 1;
  return Date.now().toString() + nonce.toString();
};

export const getError = (error: string) => ({
  success: false,
  pending: false,
  payload: { error },
});

export const promisify = (o$: Observable<unknown>) => {
  return new Promise((resolve, reject) => {
    const subscription = o$.subscribe({
      next: (data) => {
        subscription.unsubscribe();
        resolve(data);
      },
      error: (err) => {
        subscription.unsubscribe();
        reject(err);
      },
    });
  });
};

export const handleTx = (api: ApiRx) =>
  map((res: ISubmittableResult) => {
    if (res.status.isInBlock || res.status.isFinalized) {
      // @ts-expect-error
      const { success, error, batchError } = res.events.reduce<{
        success: (IEvent<[DispatchInfo]> | { orderId: string })[];
        error: IEvent<[DispatchError, DispatchInfo]>[];
        batchError: any;
      }>(
        // @ts-expect-error
        (prev, event) => {
          if (api.events.system.ExtrinsicFailed.is(event.event)) {
            return { ...prev, error: [...prev.error, event.event] };
          } else if (api.events.utility.BatchInterrupted.is(event.event)) {
            return { ...prev, batchError: [...prev.batchError, event.event] };
          } else if (api.events.system.ExtrinsicSuccess.is(event.event)) {
            return { ...prev, success: [...prev.success, event.event] };
          } else if (api.events.eqDex.OrderCreated.is(event.event)) {
            // @ts-expect-error
            const orderId = event.event.data[1].toString();
            return { ...prev, success: [...prev.success, { orderId }] };
          }

          return prev;
        },
        { success: [], error: [], batchError: [] }
      );

      if (batchError.length) {
        // @ts-expect-error
        const decoded = batchError.map((e) => [
          e.data[0],
          api.registry.findMetaError(e.data[1].asModule),
        ]);
        const message = decoded
          .map(
            // @ts-expect-error
            ([num, { section, method, docs }]) =>
              `Batch tx failed at extrinsic #${num}. ${section}.${method}: ${docs.join(
                " "
              )}`
          )
          .join(", ");

        const err = new TxError(message, decoded);
        throw err;
      } else if (error.length) {
        // @ts-expect-error
        const decoded = error.map((e) =>
          api.registry.findMetaError(e.data[0].asModule)
        );

        const message = decoded
          .map(
            // @ts-expect-error
            ({ section, method, docs }) =>
              `${section}.${method}: ${docs.join(" ")}`
          )
          .join(", ");

        const err = new TxError(message, decoded);
        throw err;
      } else if (success.length) {
        return success;
      }
    }
  });

export const capitalize = (s: string) =>
  s.length > 0 ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s;

export const priceToBn = (price: unknown): BigNumber => {
  if (typeof price === "number" || typeof price === "string") {
    return new BigNumber(price || 0, 10).div(PRICE_PRECISION);
  }

  if ((price as any).isPositive) {
    return new BigNumber((price as any).asPositive.toString(10), 10).div(
      PRICE_PRECISION
    );
  }
  if ((price as any).isNegative) {
    return new BigNumber("-" + (price as any).asNegative.toString(10), 10).div(
      PRICE_PRECISION
    );
  }

  return BIG_ZERO;
};

export const isPosInt = (s: string) => /^([1-9]\d*)$/.test(s);
