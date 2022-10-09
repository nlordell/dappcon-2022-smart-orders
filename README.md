# Smart Order

A sample CoW protocol smart order contract.

CoW protocol supports EIP-1271 signatures.
While this is typically thought of as a way for Smart Contract wallets to sign things,
we can leverage this standard for creating spcial order types on CoW with custom validation logic.

## Local Development

- `Node.js`: Recommended version 16.x
- `npm`: Must be version **7 or newer**

```shell
npx hardhat test
```

In order to run the scripts and place a sample order, first make sure you have a private key setup:
```shell
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
