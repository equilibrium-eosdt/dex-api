import { FastifyInstance, RouteShorthandOptions } from "fastify";
import {
	deposit,
	withdraw,
	getOrders,
	getBestPrices,
	getTrades,
	getMessage,
	createLimitOrder,
	createMarketOrder,
} from "./api";

export const routes = async (
	server: FastifyInstance,
	options: RouteShorthandOptions
) => {
	server.get("/orders/:token", async (request, response) => {
		// @ts-expect-error
		const token = request.params.token;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getOrders(token);
	});

	server.get("/bestPrices/:token", async (request, response) => {
		// @ts-expect-error
		const { token } = request.params;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getBestPrices(token);
	});

	server.get("/trades/:token", async (request, response) => {
		// @ts-expect-error
		const { token } = request.params;

		// @ts-expect-error
		const { page, pageSize } = request.query;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getTrades(token, undefined, page, pageSize);
	});

	server.get("/tradesByAcc/:token/:acc", async (request, response) => {
		// @ts-expect-error
		const { token, acc } = request.params;

		// @ts-expect-error
		const { page, pageSize } = request.query;

		// TODO: mb we should whitelist tokens
		if (typeof token !== "string" || typeof acc !== "string") {
			response.status(422).send(new Error("Wrong token in request"));
		}

		return await getTrades(token, acc, page, pageSize);
	});

	server.post("/deposit", async (request, response) => {
		// @ts-expect-error
		const { token, amount, address } = request.body;

		if (
			typeof address !== "string" ||
			typeof token !== "string" ||
			typeof amount !== "number"
		) {
			response.status(422).send(new Error("Wrong parameters in request body"));
		}

		return await deposit({
			token,
			amount,
			address,
		});
	});

	server.post("/withdraw", async (request, response) => {
		// @ts-expect-error
		const { token, amount, address } = request.body;

		if (
			typeof address !== "string" ||
			typeof token !== "string" ||
			typeof amount !== "number"
		) {
			response.status(422).send(new Error("Wrong parameters in request body"));
		}

		return await withdraw({
			token,
			amount,
			address,
		});
	});

	server.post("/limitOrder", async (request, response) => {
		// @ts-expect-error
		const { token, amount, limitPrice, direction, address } = request.body;

		if (
			typeof address !== "string" ||
			typeof token !== "string" ||
			typeof amount !== "number" ||
			typeof limitPrice !== "number" ||
			!["Buy", "Sell"].includes(direction)
		) {
			response.status(422).send(new Error("Wrong parameters in request body"));
		}

		return await createLimitOrder({
			token,
			amount,
			limitPrice,
			direction,
			address,
		});
	});

	server.get("/limitOrder/:messageId", async (request, response) => {
		// @ts-expect-error
		const messageId = request.params.messageId;

		// TODO: mb we should whitelist tokens
		if (typeof messageId !== "string") {
			response.status(422).send(new Error("Wrong messageId in request"));
		}

		return getMessage(messageId);
	});

	server.post("/marketOrder", async (request, response) => {
		// @ts-expect-error
		const { token, amount, limitPrice, direction, address } = request.body;

		if (
			typeof address !== "string" ||
			typeof token !== "string" ||
			typeof amount !== "number" ||
			!["Buy", "Sell"].includes(direction)
		) {
			response.status(422).send(new Error("Wrong parameters in request body"));
		}

		return createMarketOrder({
			token,
			amount,
			direction,
			address,
		});
	});

	server.get("/marketOrder/:messageId", async (request, response) => {
		// @ts-expect-error
		const messageId = request.params.messageId;

		// TODO: mb we should whitelist tokens
		if (typeof messageId !== "string") {
			response.status(422).send(new Error("Wrong messageId in request"));
		}

		return getMessage(messageId);
	});
};
