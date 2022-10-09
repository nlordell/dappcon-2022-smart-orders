# Smart Order

A sample CoW protocol smart order contract.

CoW protocol supports EIP-1271 signatures.
While this is typically thought of as a way for Smart Contract wallets to sign things,
we can leverage this standard for creating spcial order types on CoW with custom validation logic.

## Local Development

- `Node.js`: Recommended version 16.x or 18.x
- `npm`: Must be version **8 or newer**

```shell
npx hardhat test
```

In order to run the scripts and place a sample order, first make sure you have an Infura access key and a private key setup:
```shell
export INFURA_PROJECT_ID="..."
export PRIVATE_KEY="0x..."
```

Then you can create orders:
```shell
npx hardhat run scripts/placeOrder.js
```

You can also cancel created orders:
```shell
ORDER_ADDRESS="0x..." npx hardhat run scripts/cancelOrder.js
```
