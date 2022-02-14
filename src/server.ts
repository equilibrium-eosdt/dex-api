import Fastify from "fastify";
import "dotenv/config";

import { PORT } from "./constants";
import { getOrdersByToken } from "./routes";

const server = Fastify({ logger: false });

// @ts-expect-error
if (!globalThis.fetch) {
	require("isomorphic-fetch");

	// @ts-expect-error
	if (!globalThis.AbortController) {
		// @ts-expect-error
		globalThis.AbortController = require("abort-controller");
	}
}

server.register(getOrdersByToken);

server.listen(PORT, (err) => {
	if (err) {
		server.log.error(err);
		process.exit(1);
	}
	console.log(`Server started at port ${PORT}`);
});
