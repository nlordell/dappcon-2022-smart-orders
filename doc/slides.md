# Slide Notes

This file just contains some notes associated with the [slides](./slides.pdf) included in this repository.

---

## Overview

* The Basics
  * CoW Protocol orders: signing of typed data
  * ERC-1271: signature validation standard
* Smart Contract Wallet Orders
  * Safe: How to trade without gas fees
* Smart Orders
  * Good After Time Orders
  * Additional Use Cases

## The Basics: CoW Protocol Orders

CoW Protocol orders are, in essence, just a "blob" of structured data.
As you see here, they are a set of order fields that include all the required information for that order.
For example, the sell token, buy token, amounts, pro-rated fee, etc.

This structured data is used to produce an order hash.
CoW Protocol uses [EIP-712](https://eips.ethereum.org/EIPS/eip-712) typed structured data hashing for this.
The exact mechanism for how this isn't super important for understanding how CoW Protocol order work.
What is important is just understanding that an order can be hashed into a 32-byte digest that is used for signing.

For EOAs (**E**xternally **O**wned **A**ccount), which have a private key, we use ECDSA signing.
This uses an elliptic curve, with some fancy math, to produce a signature:

```js
{
  r: 0x847eba7d570c3aec0f217fa1db79d49166fa9a9088bfbab237e3168ea2a1c4a4,
  s: 0x291cf356e5639fb4c19ba5bfb4e2f8f82b371573b9d46f36b84cc39ca7472ac4,
  v: 0x1b,
}
```

## The Basics: ERC-1271

While this works for EOAs, which have private keys, it does not work for Smart Contracts, and specifically Smart Contract Wallets.
This is because Smart Contracts have no "private keys", to use for elliptic curve cryptography.
Meaning, that Smart Contracts really be used for ECDSA signing.
In order to work around this, a different signature is needed that does not depend on elliptic curve cryptography.

The solution was to standardise a new form of on-chain signature verification for Smart Contracts: [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271).
This is a simple standard that requires Smart Contracts that want to perform signature verification to implement a `isValidSignature` method:

```solidity
interface IERC1271 {
    function isValidSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (bytes4 magicValue);
}
```

The interface is very simple, but also incredibly flexible.
The verifying Smart Contract would get passed in the 32-byte hash that it wants to verify along with an implementation dependant arbitrary length byte array.
This arbitrary length byte array allows all kinds of data to be encoded and passed in, making signature verification extremely powerful.
Also, since this is just a Smart Contract `CALL`, the logic that verifies the signature can be arbitrary and make use of any on-chain state that it wants.

With respect to CoW Protocol orders, the flow now becomes:
1. Like before, prepare your order, i.e. the structured order data
2. Like before, hash this structured data into a 32-byte digest
3. Unlike before, call the `isValidSignature` on the Smart Contract signer instead of performing the usual ECDSA signature recovery and validation

## Smart Contract Wallet Orders

The spirit of ERC-1271 support in CoW Protocol was to enable Smart Contract wallets like to be able to trade on CoW Protocol and CoW Swap.
Each individual Smart Contract wallet would then be able to implement their own signature validation scheme, for example:
* Wallet owner indicates that some hash is trusted by executing an on-chain transaction
* Wallet accepts all signatures from a specific domain
* Owner off-chain signatures that are verified by the Smart Contract wallet

Specifically, the Safe v1.3 uses the latter for verifying signatures.
Because the Safe uses off-chain owner ECDSA signatures for signature verification, this means that it is possible to trade "gas-less-ly" on CoW Protocol with the Safe.

## Safe

Safe signature verification is done on a special EIP-712 `SafeMessage`.
This just wraps the same order digest that we used before for both ECDSA and ERC-1271 signature verification.
This makes the process very similar to what we had before for EOAs:
1. Like before, prepare your order, i.e. the structured order data
2. Like before, hash this structured data into a 32-byte digest
3. Unlike before, we "wrap" this digest in a `SafeMessage`
4. Like before, we generate an ECDSA signature with our EOA's private key

For multi-owner Safes, you would just collect a bunch of these signatures and concatenate them together.

For verification, the CoW Protocol settlement contract would call the ERC-1271 `isValidSignature` function implemented in the Safe Smart Contract and:
1. Pass in the concatenated owner ECDSA signatures as the `signature` bytes
2. The Safe would, for each signature decoded from the `signature` bytes:
  1. ECDSA recover the signer address
  2. Verify that the signer is an owner
3. And finally, to verify the signature, it would make sure that the total number of signatures it got is greater than the owner threshold.

We see that this already works today in CoW Protocol, for example order [`71cff264`](https://barn.explorer.cow.fi/goerli/orders/0x71cff2646c6ca7b26844fdada874db8f20ff10cc831ffc8ba381b77dc185279fd64d6de7a7630d7a63f133b882ac44427d88555562e77d0e).

## Smart Orders

Smart Order leverage the same signature verification standard, ERC-1271, and work much like the Safe:
1. You would deposit some tokens that you want to trade into the Smart Order
2. Implement ERC-1271 signature verification

**But**, instead of verifying owner ECDSA signatures, you would instead add some custom on-chain validation logic.
And **that's it**!
It is, in fact conceptually very simple, and takes advantage of just how flexible and powerful the ERC-1271 signature verification scheme is.

## Good After Time Orders

Good after time, or GAT, orders are very basically orders that become valid only after a given timestamp.
Currently, this is not supported natively by CoW Protocol, which only supports order expiry.
Thanks to ERC-1271, creating such an order and _extending_ the CoW Protocol becomes possible.
All we need to do is add a check in the `isValidSignature` implementation that the current block timestamp is older than some `validFrom` value.
The CoW Protocol services constantly simulate `isValidSignature` before each batch, meaning that the order would get automatically picked up and included in a batch auction once it matures.
Since the signature validation would revert if the check is not met, this means that we would effectively have a **trust-less** check preventing the order from being filled.
Even if a malicious solver would try to include a GAT order before it was mature, the CoW Protocol settlement contract would prevent it from executing a trade because the `isValidSignature` call would fail.
Trust-less protocol extensions, nice!

Code walkthrough...

We end up with a `GATOrders` factory contract that allows traders to place GAT orders by:
1. Making an ERC-20 approval to the factory contract for the tokens they want to trade
2. Calling the `place` function which internally:
  1. Stores the specified `validFrom` parameter
  2. Creates a new `GATOrder` contract instance
  3. Transfers the sell tokens from the trader to the Smart Order
  4. Set an ERC-20 approval to the CoW Protocol vault relayer contract

After this `place` transaction is executed, the order is ready!

For the order to trade:
1. The trader can then let the CoW Protocol know about the order by sending the order details to the API
2. The CoW Protocol would, before every auction, check wether or not the order is valid by simulating a `isValidSignature` call
    * Internally, the `isValidSignature` call would compare the current block timestamp to the order's configured `validFrom` and only validate the signature once this is the case.
3. Once the order matures, it will automatically be included in the next auction. This would make the order available to the CoW Protocol solvers for trading.
4. The CoW Protocol contract would call the `isValidSignature` on-chain
    * This ensures that we truly have a **trust-less** order validity check, regardless of whether or not the protocol or solvers misbehave.

### Getting Rid of the API Call

We can also add an `OrderPlacement` event emission to the factory contract.
This would cause GAT order placement to additionally emit an on-chain event.
We are currently building a new Ether trading flow on top of CoW Protocol and will start indexing these events in order to automatically add orders created this way to the order-book.
This would mean that traders no longer need to make an HTTP request to the API to add an order to it, but instead will have the order added automatically.

## Additional Use Cases

GAT orders aren't the only thing that is possible:
* Stop-loss orders
  * Orders that become valid only once an on-chain oracle reports that the order's sell token reaches some "stop-price".
  * For example, you can place an Ether stop-loss order to buy USDC that only becomes valid once a price oracle reports that Ether dropped below $500.00.
* Time-weighted average price (TWAP) orders
  * A large order that becomes available a little at a time.
  * This can be useful for a DAO that wants to sell a large portion of a token in their treasury over a month, a little at a time.
* And wherever else your imagination takes you!

What, I believe is so interesting about Smart Orders is that they don't require any special integration.
You just need an on-chain contract that follows the ERC-1271 signature verification standard!
This allows anyone to extend CoW Protocol to add special orders with all kinds of on-chain logic without requiring any special integration.
This democratises the ability of external parties to make special orders with special semantics that perfectly suits their needs, while having strong on-chain guarantees that the rules of their orders are being followed.
