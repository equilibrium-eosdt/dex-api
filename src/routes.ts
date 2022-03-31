import { FastifyInstance } from "fastify";
import {
  deposit,
  withdraw,
  getOrders,
  getOrdersByAddress,
  getBestPrices,
  getTrades,
  getBalances,
  getMessage,
  createLimitOrder,
  cancelLimitOrder,
  createMarketOrder,
  updateLimitOrder,
  getPendingExtrinsics,
  sudoDeposit,
} from "./api";

import {
  depositSchema,
  ordersSchema,
  ordersByAddressSchema,
  bestPricesSchema,
  tradesSchema,
  tradesByAddressSchema,
  balancesSchema,
  withdrawSchema,
  createLimitOrderSchema,
  updateLimitOrderSchema,
  getLimitOrderSchema,
  getMarketOrderSchema,
  createMarketOrderSchema,
  cancelLimitOrderSchema,
  pendingExtrinsicsSchema,
} from "./schemas";

export const routes = async (server: FastifyInstance) => {
  server.get("/orders/:token", { schema: ordersSchema }, async (request) => {
    // @ts-expect-error
    return await getOrders(request.params.token);
  });

  server.get(
    "/orders/:token/:address",
    { schema: ordersByAddressSchema },
    async (request) => {
      return await getOrdersByAddress(
        // @ts-expect-error
        request.params.token,
        // @ts-expect-error
        request.params.address
      );
    }
  );

  server.get(
    "/bestPrices/:token",
    { schema: bestPricesSchema },
    async (request) => {
      // @ts-expect-error
      return await getBestPrices(request.params.token);
    }
  );

  server.get("/trades/:token", { schema: tradesSchema }, async (request) => {
    // @ts-expect-error
    const { token } = request.params;
    // @ts-expect-error
    const { page, pageSize } = request.query;

    return await getTrades(token, undefined, page, pageSize);
  });

  server.get(
    "/tradesByAddress/:token/:address",
    { schema: tradesByAddressSchema },
    async (request) => {
      // @ts-expect-error
      const { token, address } = request.params;
      // @ts-expect-error
      const { page, pageSize } = request.query;

      return await getTrades(token, address, page, pageSize);
    }
  );

  server.get(
    "/balances/:token/:address",
    { schema: balancesSchema },
    async (request) => {
      // @ts-expect-error
      const { token, address } = request.params;

      return await getBalances(token, address);
    }
  );

  server.post("/sudo/deposit", { schema: depositSchema }, async (request) => {
    // @ts-expect-error
    const { token, amount, address, to } = request.body;

    return await sudoDeposit({
      token,
      amount,
      address,
      to,
    });
  });

  server.post("/deposit", { schema: depositSchema }, async (request) => {
    // @ts-expect-error
    const { token, amount, address } = request.body;

    return await deposit({
      token,
      amount,
      address,
    });
  });

  server.post("/withdraw", { schema: withdrawSchema }, async (request) => {
    // @ts-expect-error
    const { token, amount, address } = request.body;

    return await withdraw({
      token,
      amount,
      address,
    });
  });

  server.post(
    "/limitOrder",
    { schema: createLimitOrderSchema },
    async (request) => {
      // @ts-expect-error
      const { token, amount, limitPrice, direction, address } = request.body;

      return await createLimitOrder({
        token,
        amount,
        limitPrice,
        direction,
        address,
      });
    }
  );

  server.put(
    "/limitOrder",
    { schema: updateLimitOrderSchema },
    async (request) => {
      const {
        messageId,
        token,
        amountNew,
        limitPrice,
        limitPriceNew,
        direction,
        address,
        nonce,
        tip,
      } = request.body as any;

      return await updateLimitOrder({
        messageId,
        token,
        amountNew,
        limitPrice,
        limitPriceNew,
        address,
        direction,
        tip,
        nonce,
      });
    }
  );

  server.delete(
    "/limitOrder",
    { schema: cancelLimitOrderSchema },
    async (request) => {
      // @ts-expect-error
      const { token, price, orderId, address } = request.body;

      return await cancelLimitOrder({
        token,
        price,
        orderId,
        address,
      });
    }
  );

  server.get(
    "/limitOrder/:messageId",
    { schema: getLimitOrderSchema },
    async (request) => {
      // @ts-expect-error
      const messageId = request.params.messageId;

      return getMessage(messageId);
    }
  );

  server.post(
    "/marketOrder",
    { schema: createMarketOrderSchema },
    async (request) => {
      // @ts-expect-error
      const { token, amount, direction, address } = request.body;

      return createMarketOrder({
        token,
        amount,
        direction,
        address,
      });
    }
  );

  server.get(
    "/marketOrder/:messageId",
    { schema: getMarketOrderSchema },
    async (request) => {
      // @ts-expect-error
      const messageId = request.params.messageId;

      return getMessage(messageId);
    }
  );

  server.get(
    "/pendingExtrinsics/:address",
    { schema: pendingExtrinsicsSchema },
    async (request) => {
      // @ts-expect-error
      const { address } = request.params;
      return await getPendingExtrinsics(address);
    }
  );
};
