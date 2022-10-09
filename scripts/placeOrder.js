const { ethers } = require("hardhat");
const fetch = require("node-fetch");

const GAT_ORDERS = "0x45F228cECF21C234D6d0223c9F24f58d32CD91AE";
const ONE_MINUTE = 60;

const WETH = "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6";
const COW = "0x3430d04e42a722c5ae52c5bffbf1f230c2677600";

async function main() {
  const [signer] = await ethers.getSigners();

  const orders = (await ethers.getContractAt("GATOrders", GAT_ORDERS)).connect(
    signer,
  );
  const weth = (await ethers.getContractAt("IERC20", WETH)).connect(signer);

  const allowance = await weth.allowance(signer.address, orders.address);
  if (allowance.eq(0)) {
    console.log(`setting allowance ${signer.address} to ${orders.address}`);
    const approval = await weth.approve(
      orders.address,
      ethers.constants.MaxUint256,
    );
    await approval.wait();
  }

  const now = ~~(Date.now() / 1000);
  const order = {
    sellToken: weth.address,
    buyToken: COW,
    receiver: ethers.constants.AddressZero,
    sellAmount: ethers.utils.parseUnits("0.01", 18),
    buyAmount: ethers.utils.parseUnits("10.0", 18),
    validFrom: now + 2 * ONE_MINUTE,
    validTo: now + 20 * ONE_MINUTE,
    feeAmount: ethers.utils.parseUnits("0.0005"),
    meta: "0x",
  };
  const salt = ethers.utils.id("salt");

  console.log(`placing order with ${signer.address}`);
  const placement = await orders.place(order, salt);
  const receipt = await placement.wait();

  const { args: onchain } = receipt.events.find(
    ({ event }) => event === "OrderPlacement",
  );
  const offchain = {
    from: onchain.sender,
    sellToken: onchain.order.sellToken,
    buyToken: onchain.order.buyToken,
    receiver: onchain.order.receiver,
    sellAmount: onchain.order.sellAmount.toString(),
    buyAmount: onchain.order.buyAmount.toString(),
    validTo: onchain.order.validTo,
    appData: onchain.order.appData,
    feeAmount: onchain.order.feeAmount.toString(),
    kind: "sell",
    partiallyFillable: onchain.order.partiallyFillable,
    sellTokenBalance: "erc20",
    buyTokenBalance: "erc20",
    signingScheme: "eip1271",
    signature: onchain.signature.data,
  };

  const response = await fetch(`https://barn.api.cow.fi/goerli/api/v1/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(offchain),
  });
  const orderUid = await response.json();

  console.log(orderUid);

  // For local debugging:
  //console.log(`curl -s 'http://localhost:8080/api/v1/orders' -X POST -H 'Content-Type: application/json' --data '${JSON.stringify(offchain)}'`)
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
