import { Observable, map } from "rxjs";
import type { ApiRx } from "@polkadot/api";
import type { IEvent, ISubmittableResult } from "@polkadot/types/types";
import type { DispatchInfo, DispatchError } from "@polkadot/types/interfaces";

import { TxError } from "./types";

let nonce = 0;

export const getMessageId = () => {
	nonce = nonce + 1;
	return Date.now().toString() + nonce.toString();
};

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
			const { success, error } = res.events.reduce<{
				success: (IEvent<[DispatchInfo]> | { orderId: string })[];
				error: IEvent<[DispatchError, DispatchInfo]>[];
			}>(
				(prev, event) => {
					if (api.events.system.ExtrinsicFailed.is(event.event)) {
						return { ...prev, error: [...prev.error, event.event] };
					} else if (api.events.system.ExtrinsicSuccess.is(event.event)) {
						return { ...prev, success: [...prev.success, event.event] };
					} else if (api.events.eqDex.OrderCreated.is(event.event)) {
						const orderId = event.event.data[1].toString();
						return { ...prev, success: [...prev.success, { orderId }] };
					}

					return prev;
				},
				{ success: [], error: [] }
			);

			if (success.length) {
				return success;
			} else if (error.length) {
				const decoded = error.map((e) =>
					api.registry.findMetaError(e.data[0].asModule)
				);

				const message = decoded
					.map(
						({ section, method, docs }) =>
							`${section}.${method}: ${docs.join(" ")}`
					)
					.join(", ");

				const err = new TxError(message, decoded);
				throw err;
			}
		}
	});
