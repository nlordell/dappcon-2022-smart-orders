const { ethers } = require("hardhat");

const { ORDER_ADDRESS } = process.env;
if (ORDER_ADDRESS === undefined) {
  console.error("missing ORDER_ADDRESS=");
  process.exit(1);
}

async function main() {
  const [signer] = await ethers.getSigners();

  const order = (await ethers.getContractAt("GATOrder", ORDER_ADDRESS))
    .connect(signer);

  console.log(`cancelling order for ${signer.address}`);
  const cancellation = await order.cancel();
  await cancellation.wait();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
