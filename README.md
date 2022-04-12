# Equilibrium dex api

Nodejs api service for equilibrium decentralized exchange

## Getting started

Please use `yarn` as package manager for resolutions section in package.json to work properly

### Install

```
$ yarn
```

### Add seeds to json config

Add seed phrases as array of strings to seeds.json config at package root level. You can use seeds-example.json.
Replace seeds and rename to seeds.json.

```
$ cat seeds.json
[
	"shoe salon decrease sudden person estate describe just ozone shrimp lava injury",
	"despair grain funny buffalo liar drive eight swift soup work anchor cousin"
]
```

### Setup env variables

You can setup server port, blockchain node url and history api url using .env file

```
$ cat .env
PORT=3000
CHAIN_NODE="wss://devnet.genshiro.io"
API_ENDPOINT="https://apiv3.equilibrium.io/api"
```

If you have account to master pools add it to environment

```
POOLS_MASTER="cZifcgcutJWjcCnLheB1Zv3LMkB1jLkiREWdE5hYyGZNx97uF"
```

## Run service in dev mode

```
$  yarn dev
yarn run v1.22.17
$ . .env && nodemon src/server.ts
...
Initializing keyring...
Server started at port 3000
Keyring initialized
Address added 5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK
Address added 5G1U9j8KePj67pUcQaPZuaqvdzuV5tkdnDrZq3wZCGVYBRzb
...
Chain id initialized:  1008
```

You can check addresses retrieved from your seed phrases. Now they can be used to sign transactions.
Chain id is requested automatically on service start and is used for history api requests (such as get trades history).

## requests.http

Use `requests.http` to test service in dev mode. VSCode extension `REST Client` is very handy for http requests.

## Tokens whitelist

When `token` is in request it is validated using schema

`src/constants.ts` contains whitelisted tokens

```
export const TOKENS = ["WBTC", "ETH", "GENS", "EQD", "BNB"];
```

`src/schemas.ts` contains token schema

```
const token = { type: "string", enum: TOKENS };
```

If you need more tokens add them to `TOKENS` constant

## Get token info

Request token info via `GET` request `/token/:token`

```
GET http://127.0.0.1:3000/token/WBTC HTTP/1.1
```

Response should contain array with one element:

```
[
  {
    "token": "Wbtc",
    "asset": 2002941027,
    "lot": "0.01",
    "priceStep": "1",
    "makerFee": "0.0005",
    "takerFee": "0.001"
  }
]
```

Amounts divided by 1e18 for human readability

## Get orderbook

Request orderbook using `GET` request `/orderBook/:token?depth=:posInt`

```
GET http://127.0.0.1:3000/orderBook/WBTC?depth=2 HTTP/1.1
```

Output is orderbook prices with volume

```
{
  "bids": [
    [
      "43050.0",
      "0.68"
    ],
    [
      "43041.0",
      "0.11"
    ]
  ],
  "asks": [
    [
      "43090.0",
      "0.1"
    ],
    [
      "43100.0",
      "0.58"
    ]
  ]
}
```

## Get order list

Request order list for token (e.g. WBTC)

```
GET http://127.0.0.1:3000/orders/WBTC HTTP/1.1
```

Response is array of orders currently registered on chain

```

[
  {
    "id": 36,
    "account": "cZhbYJCcmnJnRTvbx5YVvrUrt45PL9sgwoT4e4HvpVjFKNvsA",
    "side": "buy",
    "price": "34950.0",
    "amount": "1.0",
    "createdAt": "1644842586",
    "expirationTime": "0"
  },
  ...
]
```

## Get order list by address

Request order list for token (e.g. WBTC) filtered by given address

```
GET http://127.0.0.1:3000/orders/WBTC/cZhbYJCcmnJnRTvbx5YVvrUrt45PL9sgwoT4e4HvpVjFKNvsA HTTP/1.1
```

Response is array of orders currently registered on chain

```

[
  {
    "id": 36,
    "account": "cZhbYJCcmnJnRTvbx5YVvrUrt45PL9sgwoT4e4HvpVjFKNvsA",
    "side": "buy",
    "price": "34950.0",
    "amount": "1.0",
    "createdAt": "1644842586",
    "expirationTime": "0"
  },
  ...
]
```

## Get best bid and ask

Request best bid and ask for token

```
GET http://127.0.0.1:3000/bestPrices/WBTC HTTP/1.1
```

Response is object with bid and ask

```
{
  "ask": "35010.0",
  "bid": "34970.0"
}
```

## Get trades from history api

Request trades by token from history API

```
GET http://127.0.0.1:3000/trades/WBTC HTTP/1.1
```

Response is array of trades

```
[
  {
    "id": 289,
    "chainId": 1008,
    "eventCounter": 1,
    "currency": "WBTC",
    "price": 35010,
    "amount": 1,
    "takerRest": 0,
    "makerAccountId": "cZexYhjJa3nh9wWiEVSczvVhneHWXcLBnm3SRP6gY6QGSdNRA",
    "takerAccountId": "cZexYhjJa3nh9wWiEVSczvVhneHWXcLBnm3SRP6gY6QGSdNRA",
    "makerSide": "Sell",
    "makerOrderId": 26,
    "blockNumber": 233522,
    "exchangeDate": "2022-02-11T15:07:12",
    "takerFee": 35.01,
    "makerFee": 17.505
  },
  ...
]
```

Use pagination when possible

```
GET http://127.0.0.1:3000/trades/WBTC?page=0&pageSize=5 HTTP/1.1
```

Defaults are `page=0` and `pageSize=100`

To get trades list for address use request

```
GET http://127.0.0.1:3000/tradesByAddress/WBTC/cZhTPXeT5o3DVgEnRQ95Vi8BNiyPsDoFDovXZLCeWmDKB89WW HTTP/1.1
```

Response format is the same. Also pagination can be used

```
GET http://127.0.0.1:3000/tradesByAddress/WBTC/cZhTPXeT5o3DVgEnRQ95Vi8BNiyPsDoFDovXZLCeWmDKB89WW?page=0&pageSize=3 HTTP/1.1
```

## Get balances

To get trading balances send `GET` request `balances/:token/:address`

```
GET http://127.0.0.1:3000/balances/WBTC/5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK HTTP/1.1
```

Response looks like

```
{
  "masterBalance": "1000000899999941400",
  "tradingBalance": "100000000000"
}
```

Balance precision is 10^9. Divide by 10^9 to get token amount.

If you don't have trading balance object key `tradingBalance` will be missing. Transfer funds using deposit method below.

## Get latest usd prices for all tokens on chain

To get latest usd prices from oracles on chain send `GET` request `/rates`

```
GET http://127.0.0.1:3000/rates HTTP/1.1
```

Response format looks like:

```
[
  {
    "price": "426.887",
    "token": "Bnb",
    "asset": 6450786
  },
  {
    "price": "2.6186",
    "token": "Crv",
    "asset": 6517366
  },
  ...
]
```

## Get locked balances

To get info on account balances locked by orders send `GET` request `/lockedBalance/:address/`

```
GET http://127.0.0.1:3000/lockedBalance/cZirADTgk9CYy2ed3y1UPh8jTmWoes2SRd1JSUDntkPpiMQ6X HTTP/1.1
```

You should recieve

```
{
  "collateralUsd": "260154.7442",
  "debtUsd": "0",
  "lockedUsd": "124787",
  "availableUsd": "135367.7442"
}
```

Where `collateralUsd` is your total trading balance in USD, `lockedUsd` is amount locked by active orders

If you use the same account to borrow funds `debtUsd` is your total debt in USD

## Deposit funds to trading subaccount

To start trading you should deposit funds to trading account.
Use deposit request

```
POST http://127.0.0.1:3000/deposit HTTP/1.1
content-type: application/json

{
  "address": "5G1U9j8KePj67pUcQaPZuaqvdzuV5tkdnDrZq3wZCGVYBRzb",
  "token": "WBTC",
  "amount": 0.01
}
```

Request is synchronous. Wait until operation is completed.

Funds fill be transferred FROM address in request to trading subaccount.

Successfull response looks like this

```
[
  {
    "index": "0x0000",
    "data": [
      {
        "weight": 2580800000,
        "class": "Normal",
        "paysFee": "Yes"
      }
    ]
  }
]
```

Failed response can look like this

```
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "bailsman.WrongMargin:  Wrong margin for operation performing"
}
```

## Withdraw funds from trading subaccount

Use withdraw request

```
POST http://127.0.0.1:3000/withdraw HTTP/1.1
content-type: application/json

{
  "address": "5G1U9j8KePj67pUcQaPZuaqvdzuV5tkdnDrZq3wZCGVYBRzb",
  "token": "WBTC",
  "amount": 0.01
}
```

Request is synchronous. Wait until operation is completed.

Funds fill be transferred TO address in request rom trading subaccount.

Successfull response looks like this

```
[
  {
    "index": "0x0000",
    "data": [
      {
        "weight": 1669051000,
        "class": "Normal",
        "paysFee": "Yes"
      }
    ]
  }
]
```

## Register market order

To register market order send request

```
POST http://127.0.0.1:3000/marketOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "WBTC",
  "amount": 1,
  "direction": "buy"
}
```

Service will immediately respond with message id

```
{
  "success": true,
  "payload": {
    "messageId": "16448487391741"
  }
}
```

Use this message id to request order status

```
GET http://127.0.0.1:3000/marketOrder/16448489453521 HTTP/1.1
```

```
{
  "success": true,
  "pending": false,
  "payload": [
    {
      "index": "0x0000",
      "data": [
        {
          "weight": 1271400000,
          "class": "Normal",
          "paysFee": "Yes"
        }
      ]
    }
  ]
}
```

This status means that order is successfully registered in chain.

If order creation is in progress (we haven't recieved "success" event)

```
{
  "success": false,
  "pending": true,
  "payload": {
    "message": "Order is creating"
  }
}
```

## Register limit order

To register limit order you can send request

```
POST http://127.0.0.1:3000/limitOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "WBTC",
  "limitPrice": 34940,
  "amount": 1,
  "direction": "buy"
}
```

You will recieve immediate response with message id.

```
{
  "success": true,
  "payload": {
    "messageId": "16448490953732",
    "nonce": 73,
    "tip": 0
  }
}
```

Use this message id to request order status

```
GET http://127.0.0.1:3000/limitOrder/16448490953732 HTTP/1.1
```

Successfull response has `orderId`. You can also see this order in get order list request (see above)
If you recieve `orderId` in payload - order is registered in orderbook

```
{
  "success": true,
  "pending": false,
  "payload": [
    {
      "orderId": "39"
    },
    {
      "index": "0x0000",
      "data": [
        {
          "weight": 1271400000,
          "class": "Normal",
          "paysFee": "Yes"
        }
      ]
    }
  ]
}
```

If order is executed immediately on arrival it won't be registered in orderbook and won't have `orderId`

Then you will recieve `success: true` and `pending: false` without `orderId` inside payload.

```
{
  "success": true,
  "pending": false,
  "payload": [
    {
      "index": "0x0000",
      "data": [
        {
          "weight": 1271400000,
          "class": "Normal",
          "paysFee": "Yes"
        }
      ]
    }
  ]
}
```

Unsuccessfull order creation will result in message like this

```
  "success": false,
  "pending": false,
  "payload": {
    "error": {
      "registryErrors": [
        {
          "args": [],
          "docs": [
            " Order price should be in corridor"
          ],
          "fields": [],
          "index": 7,
          "method": "OrderPriceShouldBeInCorridor",
          "name": "OrderPriceShouldBeInCorridor",
          "section": "eqDex"
        }
      ]
    }
  }
}
```

## Cancel limit order

To cancel limit order send `DELETE` request

```
DELETE http://127.0.0.1:3000/limitOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "WBTC",
  "price": 34940,
  "orderId": 1620
}
```

Successfull response looks like this

```
[
  {
    "index": "0x0000",
    "data": [
      {
        "weight": 700300000,
        "class": "Normal",
        "paysFee": "Yes"
      }
    ]
  }
]
```

Failed response looks like this

```
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "eqDex.OrderNotFound:  No order found by id and price"
}
```

## Replace limit order

You can replace limit order using `PUT` limitOrder request. When you sent `POST` limitOrder request service responded with `messageId` and `nonce`. Use them to replace order. Add `tip` to raise your transaction priority. It will be used if transaction is waiting for block to finalize. Transactions with same nonce wich has highest `tip` will be in block.

There are 4 scenarios:

- Limit order is queued and replaced by new one
- Limit order is queued and cancelled (send `limitPriceNew = 0`)
- Limit order is on chain. It is cancelled and new one registered
- Limit order is on chain and `limitPriceNew = 0`. Order is cancelled

```
PUT http://127.0.0.1:3000/limitOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "WBTC",
  "limitPrice": 39002,
  "limitPriceNew": 39003,
  "amountNew": 0.1,
  "direction": "buy",
  "messageId": "16454558118451",
  "nonce": 71,
  "tip": 10
}
```

If you send `limitPriceNew = 0` order will be cancelled.

Order can be replaced and cancelled even before it is finalized in block.

Possible success response looks like this

```
{
  "success": true,
  "payload": {
    "message": "Limit order is creating",
    "messageId": "16454558286312",
    "nonce": 73,
    "tip": 0
  }
}
```

## Get pending extrinsics by address

To get pending createLimitOrder extrinsics send `GET`

```
GET http://127.0.0.1:3000/pendingExtrinsics/cZirADTgk9CYy2ed3y1UPh8jTmWoes2SRd1JSUDntkPpiMQ6X
```

Response is array of `eqDex.createOrder` extrinsics

```
[
  {
    "isSigned": true,
    "method": {
      "args": {
        "asset": {
          "0": "2,002,941,027"
        },
        "order_type": {
          "Limit": {
            "price": "38,990,000,000,000",
            "expiration_time": "0"
          }
        },
        "side": "Buy",
        "amount": "10,000,000,000,000,000"
      },
      "method": "createOrder",
      "section": "eqDex"
    },
    "era": {
      "MortalEra": {
        "period": "64",
        "phase": "21"
      }
    },
    "nonce": "780",
    "signature": "0x94502be17d2155c99532fd12ce80e192524c2c89f948fddfe15cfc1c3f936645051526abda83d0c23eabd31af9410a951a49fc800284367aeda51cbaa7be518f",
    "signer": "cZirADTgk9CYy2ed3y1UPh8jTmWoes2SRd1JSUDntkPpiMQ6X",
    "tip": "0"
  },
  ...
]
```

## Working with mm pools

Some actions can be made using mm pools (if you have account which masters them).

They are similar to ordinary actions except naming (`orders` -> `ordersMm`) for GET requests
or `"isUsingPool": true` parameter for POSTlike requests

Such requests must be called using account set up to master pools.

Requests are similar to ordinary ones - please read their description above

### Setup env variables

If you have account to master pools add it to environment

```
$ cat .env
POOLS_MASTER="cZifcgcutJWjcCnLheB1Zv3LMkB1jLkiREWdE5hYyGZNx97uF"
```

### Get order list for pool master

Request order list for token (e.g. WBTC)

```
GET http://127.0.0.1:3000/ordersMm/WBTC HTTP/1.1
```

Response is array of orders currently registered on chain

```

[
  {
    "id": 36,
    "account": "cZhbYJCcmnJnRTvbx5YVvrUrt45PL9sgwoT4e4HvpVjFKNvsA",
    "side": "buy",
    "price": "34950.0",
    "amount": "1.0",
    "createdAt": "1644842586",
    "expirationTime": "0"
  },
  ...
]
```

### Get trades from history api

Request trades by token from history API

```
GET http://127.0.0.1:3000/tradesMm/WBTC HTTP/1.1
```

Response is array of trades

```
[
  {
    "id": 289,
    "chainId": 1008,
    "eventCounter": 1,
    "currency": "WBTC",
    "price": 35010,
    "amount": 1,
    "takerRest": 0,
    "makerAccountId": "cZexYhjJa3nh9wWiEVSczvVhneHWXcLBnm3SRP6gY6QGSdNRA",
    "takerAccountId": "cZexYhjJa3nh9wWiEVSczvVhneHWXcLBnm3SRP6gY6QGSdNRA",
    "makerSide": "Sell",
    "makerOrderId": 26,
    "blockNumber": 233522,
    "exchangeDate": "2022-02-11T15:07:12",
    "takerFee": 35.01,
    "makerFee": 17.505
  },
  ...
]
```

Use pagination when possible

```
GET http://127.0.0.1:3000/tradesMm/WBTC?page=0&pageSize=5 HTTP/1.1
```

Defaults are `page=0` and `pageSize=100`

### Get balances for pool master

To get trading balances send `GET` request `balancesMm/:token`

```
GET http://127.0.0.1:3000/balancesMm/WBTC HTTP/1.1
```

Response looks like

```
{
  "masterBalance": "1000000899999941400",
  "tradingBalance": "100000000000"
}
```

### Get locked balances

To get info on account balances locked by orders send `GET` request `/lockedBalanceMm`

```
GET http://127.0.0.1:3000/lockedBalanceMm HTTP/1.1
```

You should recieve

```
{
  "collateralUsd": "260154.7442",
  "debtUsd": "0",
  "lockedUsd": "124787",
  "availableUsd": "135367.7442"
}
```

### Deposit funds from pool to trading subaccount

To start trading you should deposit funds to trading account.
Use deposit request with `address` pool master

```
POST http://127.0.0.1:3000/deposit HTTP/1.1
content-type: application/json

{
  "address": "5G1U9j8KePj67pUcQaPZuaqvdzuV5tkdnDrZq3wZCGVYBRzb",
  "token": "WBTC",
  "amount": 0.01,
  "isUsingPool": true
}
```

Request is synchronous. Wait until operation is completed.

Funds fill be transferred FROM POOL in request to trading subaccount.

Balance precision is 10^9. Divide by 10^9 to get token amount.

### Withdraw funds from trading subaccount to pool

Use withdraw request with `address` pool master

```
POST http://127.0.0.1:3000/withdraw HTTP/1.1
content-type: application/json

{
  "address": "5G1U9j8KePj67pUcQaPZuaqvdzuV5tkdnDrZq3wZCGVYBRzb",
  "token": "WBTC",
  "amount": 0.01,
  "isUsingPool": true
}
```

Request is synchronous. Wait until operation is completed.

Funds fill be transferred TO address in request rom trading subaccount.

### Register limit order

To register limit order you can send request with `address` pool master

The difference for pool master is `"isUsingPool": true` parameter

```
POST http://127.0.0.1:3000/limitOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "WBTC",
  "limitPrice": 34940,
  "amount": 1,
  "direction": "buy",
  "isUsingPool": true
}
```

### Cancel limit order

To cancel limit order send `DELETE` request with `address` pool master

The difference for pool master is `"isUsingPool": true` parameter

```
DELETE http://127.0.0.1:3000/limitOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "ETH",
  "price": 3091,
  "orderId": 58,
  "isUsingPool": true
}
```

## Replace limit order

You can replace limit order using `PUT` limitOrder request.

The difference for pool master is `"isUsingPool": true` parameter

```
PUT http://127.0.0.1:3000/limitOrder HTTP/1.1
content-type: application/json

{
  "address": "5GC1gZuBV5YSwgkxjQrPggF2fLhQcAUeAiXnDaBUg6wJPvtK",
  "token": "WBTC",
  "limitPrice": 39002,
  "limitPriceNew": 39003,
  "amountNew": 0.1,
  "direction": "buy",
  "messageId": "16454558118451",
  "nonce": 71,
  "tip": 10,
  "isUsingPool": true
}
```

## Build and run

To build and run service use `start` command

```
$ yarn start
```
