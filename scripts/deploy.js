const { ethers } = require("hardhat");

const SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";

async function main() {
  const GATOrders = await ethers.getContractFactory("GATOrders");
  const orders = await GATOrders.deploy(SETTLEMENT);

  await orders.deployed();

  console.log(`GAT orders deployed to ${orders.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
