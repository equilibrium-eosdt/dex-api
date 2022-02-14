# mm-api

Nodejs api service for equilibrium decentralized exchange

## Getting started

Please use `yarn` as package manager for resolutions section in package.json to work properly

### Install

```
$ yarn
```

### Add seeds to json config

Add seed phrases as array of strings to seeds.json config at root level. You can use seeds-example.json.
Replace seeds and rename to seeds.json.

```
$ cat seeds.json
[
	"lock idea vague ordinary pool stuff summer whale fame laptop assist slow",
	"inflict vast endless unit addict clap wage village drum pool motion next"
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

Defaults are `page=0` and `pageSize=10000`

To get trades list for address use request

```
GET http://127.0.0.1:3000/tradesByAcc/WBTC/cZhTPXeT5o3DVgEnRQ95Vi8BNiyPsDoFDovXZLCeWmDKB89WW HTTP/1.1
```

Response format is the same. Also pagination can be used

```
GET http://127.0.0.1:3000/tradesByAcc/WBTC/cZhTPXeT5o3DVgEnRQ95Vi8BNiyPsDoFDovXZLCeWmDKB89WW?page=0&pageSize=3 HTTP/1.1
```

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
  "direction": "Buy"
}
```

Service will immediately respond with message id

```
{
  "success": true,
  "data": {
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
  "direction": "Buy"
}
```

You will recieve immediate response with message id.

```
{
  "success": true,
  "data": {
    "messageId": "16448490953732"
  }
}
```

Use this message id to request order status

```
GET http://127.0.0.1:3000/limitOrder/16448490953732 HTTP/1.1
```

Successfull response has `orderId`. You can also see this order in get order list request (see above)

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

## Build and run

To build and run service use `start` command

```
$ yarn start
```
