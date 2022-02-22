import type { RegistryError } from "@polkadot/types/types";
import type { FixedU128 } from "@polkadot/types/interfaces";
import type { AnyNumber } from "@polkadot/types-codec/types";
import type {
  AugmentedSubmittable,
  SubmittableExtrinsic,
  ApiTypes,
} from "@polkadot/api-base/types";
import { Asset, OrderType, OrderSide } from "@equilab/api/genshiro/interfaces";

export enum Direction {
  Buy = "Buy",
  Sell = "Sell",
}
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

export interface CreateOrderExtrinsicPayload {
  asset:
    | Asset
    | {
        0?: any;
      }
    | string
    | Uint8Array;
  orderType:
    | OrderType
    | {
        Limit: any;
      }
    | {
        Market: any;
      }
    | string
    | Uint8Array;
  side: OrderSide | "Buy" | "Sell" | number | Uint8Array;
  amount: FixedU128 | AnyNumber | Uint8Array;
}

export interface CreateOrderExtrinsic {
  signer: string;
  method: {
    args: {
      payload: CreateOrderExtrinsicPayload;
    };
    method: string;
    section: string;
  };
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

export const isCreateOrderExtrinsic = (
  raw: unknown
): raw is CreateOrderExtrinsic =>
  typeof (raw as CreateOrderExtrinsic).method === "object" &&
  (raw as CreateOrderExtrinsic).method.section === "eqDex" &&
  (raw as CreateOrderExtrinsic).method.method === "createOrder";
