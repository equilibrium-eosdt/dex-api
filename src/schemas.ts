import { FastifySchema } from "fastify";

import {
	ADDRESS_LENGTH_MIN,
	ADDRESS_LENGTH_MAX,
	TOKENS,
	DIRECTIONS,
} from "./constants";

const token = { type: "string", enum: TOKENS };
const amount = { type: "number", exclusiveMinimum: 0 };
const address = {
	type: "string",
	minLength: ADDRESS_LENGTH_MIN,
	maxLength: ADDRESS_LENGTH_MAX,
};

const tokenParams = {
	params: {
		type: "object",
		required: ["token"],
		properties: {
			token,
		},
	},
};

export const ordersSchema: FastifySchema = tokenParams;

export const bestPricesSchema: FastifySchema = tokenParams;

export const tradesSchema: FastifySchema = {
	params: {
		type: "object",
		required: ["token"],
		properties: {
			token,
		},
	},
	querystring: {
		type: "object",
		properties: {
			page: { type: "number" },
			pageSize: { type: "number" },
		},
	},
};

export const tradesByAddressSchema: FastifySchema = {
	params: {
		type: "object",
		required: ["token", "address"],
		properties: {
			token,
			address,
		},
	},
	querystring: {
		type: "object",
		properties: {
			page: { type: "number" },
			pageSize: { type: "number" },
		},
	},
};

export const balancesSchema: FastifySchema = {
	params: {
		type: "object",
		required: ["token", "address"],
		properties: {
			token,
			address,
		},
	},
};

export const depositSchema: FastifySchema = {
	body: {
		type: "object",
		required: ["token", "address", "amount"],
		properties: {
			token,
			address,
			amount,
		},
	},
};

export const withdrawSchema = depositSchema;

export const createLimitOrderSchema: FastifySchema = {
	body: {
		type: "object",
		required: ["token", "address", "amount", "limitPrice", "direction"],
		properties: {
			token,
			address,
			amount,
			limitPrice: { type: "number", exclusiveMinimum: 0 },
			direction: { type: "string", enum: DIRECTIONS },
		},
	},
};

export const updateLimitOrderSchema: FastifySchema = {
	body: {
		type: "object",
		required: [
			"token",
			"address",
			"amountNew",
			"limitPrice",
			"limitPriceNew",
			"direction",
			"messageId",
		],
		properties: {
			token,
			address,
			limitPrice: { type: "number", exclusiveMinimum: 0 },
			limitPriceNew: { type: "number", minimum: 0 },
			amountNew: { type: "number", minimum: 0 },
			direction: { type: "string", enum: DIRECTIONS },
			messageId: { type: "string" },
			nonce: { type: "number" },
			tip: { type: "number" },
		},
	},
};
