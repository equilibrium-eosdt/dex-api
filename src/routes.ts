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
  cancelLimitOrders,
  createMarketOrder,
  updateLimitOrder,
  getPendingExtrinsics,
  sudoDeposit,
  getLockedBalance,
  getRates,
  getDepth,
  getToken,
  getBorrowerAddress,
  getChainId,
} from "./api";
import { POOLS_MASTER } from "./constants";

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
  server.get("/chainId", async () => {
    return getChainId();
  });

  server.get(
    "/token/:token",
    { schema: ordersSchema },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return await getToken(request.params.token);
    }
  );

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
    "/ordersMm/:token",
    { schema: ordersSchema },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      return await getOrdersByAddress(request.params.token, POOLS_MASTER);
    }
  );

  server.get(
    "/orderBook/:token",
    async (
      request: FastifyRequest<{
        Params: { token: string };
        Querystring: { depth: string };
      }>
    ) => await getDepth(request.params.token, request.query.depth)
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
    "/tradesMm/:token",
    { schema: tradesSchema },
    async (
      request: FastifyRequest<{
        Params: { token: string };
        Querystring: { page: number; pageSize: number };
      }>
    ) => {
      const { token } = request.params;
      const { page, pageSize } = request.query;

      const address = await getBorrowerAddress(POOLS_MASTER);

      return await getTrades(token, address as string, page, pageSize);
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

  server.get(
    "/balancesMm/:token",
    { schema: ordersSchema },
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      const { token } = request.params;

      return await getBalances(token, POOLS_MASTER);
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

  server.get("/lockedBalanceMm", async () => {
    return await getLockedBalance(POOLS_MASTER);
  });

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
      const { token, amount, address, isUsingPool } = request.body;

      return await deposit({
        token,
        amount,
        address,
        isUsingPool,
      });
    }
  );

  server.post(
    "/withdraw",
    { schema: withdrawSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof withdraw>[0] }>
    ) => {
      const { token, amount, address, isUsingPool } = request.body;

      return await withdraw({
        token,
        amount,
        address,
        isUsingPool,
      });
    }
  );

  server.post(
    "/limitOrder",
    { schema: createLimitOrderSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof createLimitOrder>[0] }>
    ) => {
      const { token, amount, limitPrice, direction, address, isUsingPool } =
        request.body;

      return await createLimitOrder({
        token,
        amount,
        limitPrice,
        direction,
        address,
        isUsingPool,
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
        isUsingPool,
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
        isUsingPool,
      });
    }
  );

  server.delete(
    "/limitOrder",
    { schema: cancelLimitOrderSchema },
    async (
      request: FastifyRequest<{ Body: Parameters<typeof cancelLimitOrder>[0] }>
    ) => {
      const { token, price, orderId, address, isUsingPool } = request.body;

      return await cancelLimitOrder({
        token,
        price,
        orderId,
        address,
        isUsingPool,
      });
    }
  );

  server.delete(
    "/limitOrders",
    async (
      request: FastifyRequest<{ Body: Parameters<typeof cancelLimitOrders>[0] }>
    ) => {
      const { orders, address, isUsingPool } = request.body;

      return await cancelLimitOrders({
        orders,
        address,
        isUsingPool,
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
