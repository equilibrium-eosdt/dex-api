import { FastifyInstance, FastifyRequest } from "fastify";
import {
  deposit,
  withdraw,
  getOrders,
  getOrdersByAddress,
  getBestPrices,
  getTrades,
  getBalances,
  getMargin,
  getMessage,
  createLimitOrder,
  cancelLimitOrder,
  createMarketOrder,
  updateLimitOrder,
  getPendingExtrinsics,
  sudoDeposit,
  getLockedBalance,
  getRates,
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
  addressSchema,
} from "./schemas";

export const routes = async (server: FastifyInstance) => {
  server.get(
    "/orders/:token",
    { schema: ordersSchema },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return await getOrders(request.params.token);
    }
  );

  server.get(
    "/orders/:token/:address",
    { schema: ordersByAddressSchema },
    async (
      request: FastifyRequest<{ Params: { token: string; address: string } }>
    ) => {
      return await getOrdersByAddress(
        request.params.token,
        request.params.address
      );
    }
  );

  server.get(
    "/bestPrices/:token",
    { schema: bestPricesSchema },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return await getBestPrices(request.params.token);
    }
  );

  server.get(
    "/trades/:token",
    { schema: tradesSchema },
    async (
      request: FastifyRequest<{
        Params: { token: string };
        Querystring: { page: number; pageSize: number };
      }>
    ) => {
      const { token } = request.params;
      const { page, pageSize } = request.query;

      return await getTrades(token, undefined, page, pageSize);
    }
  );

  server.get(
    "/tradesByAddress/:token/:address",
    { schema: tradesByAddressSchema },
    async (
      request: FastifyRequest<{
        Params: { token: string; address: string };
        Querystring: { page: number; pageSize: number };
      }>
    ) => {
      const { token, address } = request.params;
      const { page, pageSize } = request.query;

      return await getTrades(token, address, page, pageSize);
    }
  );

  server.get(
    "/balances/:token/:address",
    { schema: balancesSchema },
    async (
      request: FastifyRequest<{ Params: { token: string; address: string } }>
    ) => {
      const { token, address } = request.params;

      return await getBalances(token, address);
    }
  );

  server.get("/rates", async () => {
    return await getRates();
  });

  server.get(
    "/margin/:address",
    { schema: addressSchema },
    async (request: FastifyRequest<{ Params: { address: string } }>) => {
      return await getMargin(request.params.address);
    }
  );

  server.get(
    "/lockedBalance/:address",
    { schema: addressSchema },
    async (request: FastifyRequest<{ Params: { address: string } }>) => {
      return await getLockedBalance(request.params.address);
    }
  );

  server.post(
    "/sudo/deposit",
    { schema: depositSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof sudoDeposit>[0] }>
    ) => {
      const { token, amount, address, to } = request.body;

      return await sudoDeposit({
        token,
        amount,
        address,
        to,
      });
    }
  );

  server.post(
    "/deposit",
    { schema: depositSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof deposit>[0] }>
    ) => {
      const { token, amount, address } = request.body;

      return await deposit({
        token,
        amount,
        address,
      });
    }
  );

  server.post(
    "/withdraw",
    { schema: withdrawSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof withdraw>[0] }>
    ) => {
      const { token, amount, address } = request.body;

      return await withdraw({
        token,
        amount,
        address,
      });
    }
  );

  server.post(
    "/limitOrder",
    { schema: createLimitOrderSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof createLimitOrder>[0] }>
    ) => {
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
    async (
      request: FastifyRequest<{ Body: Parameters<typeof updateLimitOrder>[0] }>
    ) => {
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
      } = request.body;

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
    async (
      request: FastifyRequest<{ Body: Parameters<typeof cancelLimitOrder>[0] }>
    ) => {
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
    async (request: FastifyRequest<{ Params: { messageId: string } }>) => {
      const messageId = request.params.messageId;

      return getMessage(messageId);
    }
  );

  server.post(
    "/marketOrder",
    { schema: createMarketOrderSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof createMarketOrder>[0] }>
    ) => {
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
    async (request: FastifyRequest<{ Params: { messageId: string } }>) => {
      const messageId = request.params.messageId;

      return getMessage(messageId);
    }
  );

  server.get(
    "/pendingExtrinsics/:address",
    { schema: pendingExtrinsicsSchema },
    async (request: FastifyRequest<{ Params: { address: string } }>) => {
      const { address } = request.params;
      return await getPendingExtrinsics(address);
    }
  );
};
