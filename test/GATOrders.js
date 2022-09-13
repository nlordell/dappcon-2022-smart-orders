const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const ONE_HOUR = 60 * 60;

describe("GATOrder", function () {
  async function fixture() {
    const [_deployer, owner] = await ethers.getSigners();

    const TestSettlement = await ethers.getContractFactory("TestSettlement");
    const settlement = await TestSettlement.deploy();

    const GATOrders = await ethers.getContractFactory("GATOrders");
    const orders = await GATOrders.deploy(settlement.address);

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const sellToken = await TestERC20.deploy();
    const buyToken = await TestERC20.deploy();

    const sellAmount = ethers.utils.parseUnits("1.0", 18);
    const feeAmount = ethers.utils.parseUnits("0.01", 18);
    await sellToken.mint(owner.address, sellAmount.add(feeAmount));

    return {
      settlement,
      orders,
      owner,
      sellToken,
      buyToken,
      sellAmount,
      feeAmount,
    };
  }

  describe("constructor", function () {
    it("Should set the contract values", async function () {
      const { settlement, orders } = await loadFixture(fixture);

      expect(await orders.settlement()).to.equal(settlement.address);
      expect(await orders.domainSeparator()).to.equal(
        await settlement.domainSeparator(),
      );
    });
  });

  describe("place", function () {
    it("Should create a GAT order", async function () {
      const {
        settlement,
        orders,
        owner,
        sellToken,
        buyToken,
        sellAmount,
        feeAmount,
      } = await loadFixture(fixture);

      const now = await time.latest();
      const order = {
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        receiver: ethers.constants.AddressZero,
        sellAmount,
        buyAmount: ethers.utils.parseUnits("1.0", 6),
        validFrom: now + ONE_HOUR,
        validTo: now + 2 * ONE_HOUR,
        feeAmount,
        meta: "0x",
      };
      const salt = ethers.utils.id("salt");

      await sellToken.connect(owner).approve(
        orders.address,
        ethers.constants.MaxUint256,
      );
      const orderUid = await orders
        .connect(owner)
        .callStatic.place(order, salt);
      const instance = ethers.utils.getAddress(
        ethers.utils.hexDataSlice(orderUid, 32, 52),
      );

      await expect(orders.connect(owner).place(order, salt))
        .to.emit(orders, "OrderPlacement")
        .withArgs(instance, anyValue, anyValue, "0x");

      const orderStructHash = ethers.utils._TypedDataEncoder.hashStruct(
        "Order",
        {
          "Order": [
            { name: "sellToken", type: "address" },
            { name: "buyToken", type: "address" },
            { name: "receiver", type: "address" },
            { name: "sellAmount", type: "uint256" },
            { name: "buyAmount", type: "uint256" },
            { name: "validTo", type: "uint32" },
            { name: "appData", type: "bytes32" },
            { name: "feeAmount", type: "uint256" },
            { name: "kind", type: "string" },
            { name: "partiallyFillable", type: "bool" },
            { name: "sellTokenBalance", type: "string" },
            { name: "buyTokenBalance", type: "string" },
          ],
        },
        {
          sellToken: order.sellToken,
          buyToken: order.buyToken,
          receiver: owner.address,
          sellAmount: order.sellAmount,
          buyAmount: order.buyAmount,
          validTo: order.validTo,
          appData: ethers.utils.id("smart orders are cool"),
          feeAmount: order.feeAmount,
          kind: "sell",
          partiallyFillable: false,
          sellTokenBalance: "erc20",
          buyTokenBalance: "erc20",
        },
      );
      const orderHash = ethers.utils.solidityKeccak256(
        ["bytes2", "bytes32", "bytes32"],
        ["0x1901", await settlement.domainSeparator(), orderStructHash],
      );

      expect(orderUid).to.eq(
        ethers.utils.solidityPack(
          ["bytes32", "address", "uint32"],
          [orderHash, instance, order.validTo],
        ),
      );
    });

    it("Should transfer out sell plus fee amounts", async function () {
      const {
        orders,
        owner,
        sellToken,
        buyToken,
        sellAmount,
        feeAmount,
      } = await loadFixture(fixture);

      const now = await time.latest();
      const order = {
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        receiver: ethers.constants.AddressZero,
        sellAmount,
        buyAmount: ethers.utils.parseUnits("1.0", 6),
        validFrom: now + ONE_HOUR,
        validTo: now + 2 * ONE_HOUR,
        feeAmount,
        meta: "0x",
      };
      const salt = ethers.utils.id("salt");

      await sellToken.connect(owner).approve(
        orders.address,
        ethers.constants.MaxUint256,
      );
      const orderUid = await orders
        .connect(owner)
        .callStatic.place(order, salt);
      const instance = ethers.utils.getAddress(
        ethers.utils.hexDataSlice(orderUid, 32, 52),
      );

      expect(await sellToken.balanceOf(owner.address))
        .to.equal(sellAmount.add(feeAmount));
      expect(await sellToken.balanceOf(instance)).to.equal(0);

      await orders.connect(owner).place(order, salt);

      expect(await sellToken.balanceOf(owner.address)).to.equal(0);
      expect(await sellToken.balanceOf(instance))
        .to.equal(sellAmount.add(feeAmount));
    });
  });
});
