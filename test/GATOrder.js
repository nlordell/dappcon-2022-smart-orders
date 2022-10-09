const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const ONE_HOUR = 60 * 60;
const ERC1271_MAGIC_VALUE = "0x1626ba7e";

describe("GATOrder", function () {
  async function fixture() {
    const [_deployer, owner, bob] = await ethers.getSigners();

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const sellToken = await TestERC20.deploy();

    const validFrom = (await time.latest()) + ONE_HOUR;

    const orderHash = ethers.utils.id("moo");

    const TestSettlement = await ethers.getContractFactory("TestSettlement");
    const settlement = await TestSettlement.deploy();

    const GATOrder = await ethers.getContractFactory("GATOrder");
    const order = await GATOrder.deploy(
      owner.address,
      sellToken.address,
      validFrom,
      orderHash,
      settlement.address,
    );

    const sellAmount = ethers.utils.parseUnits("1.0", 18);
    await sellToken.mint(order.address, sellAmount);

    return {
      owner,
      sellToken,
      sellAmount,
      validFrom,
      orderHash,
      settlement,
      order,
      bob,
    };
  }

  describe("constructor", function () {
    it("Should set the contract values", async function () {
      const {
        owner,
        sellToken,
        validFrom,
        orderHash,
        order,
      } = await loadFixture(fixture);

      expect(await order.owner()).to.equal(owner.address);
      expect(await order.sellToken()).to.equal(sellToken.address);
      expect(await order.validFrom()).to.equal(validFrom);
      expect(await order.orderHash()).to.equal(orderHash);
    });

    it("Should set approval to vault relayer", async function () {
      const { sellToken, settlement, order } = await loadFixture(fixture);

      expect(
        await sellToken.allowance(
          order.address,
          await settlement.vaultRelayer(),
        ),
      ).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe("isValidSignature", function () {
    it("Should revert when order hash doesn't match", async function () {
      const { orderHash, order } = await loadFixture(fixture);

      const badHash = `0x${"11".repeat(32)}`;
      expect(badHash).to.not.eq(orderHash);

      await expect(order.isValidSignature(badHash, "0x")).to.be.revertedWith(
        "invalid order",
      );
    });

    it("Should revert if the order has not yet matured", async function () {
      const { orderHash, validFrom, order } = await loadFixture(fixture);

      expect(await time.latest()).to.be.lessThan(validFrom);

      await expect(order.isValidSignature(orderHash, "0x")).to.be.revertedWith(
        "not mature",
      );
    });

    it("Should validate for correct order hash once matured", async function () {
      const { orderHash, validFrom, order } = await loadFixture(fixture);

      await time.increaseTo(validFrom);

      expect(await order.isValidSignature(orderHash, "0x")).to.equal(
        ERC1271_MAGIC_VALUE,
      );
    });
  });

  describe("cancel", function () {
    it("Should transfer balance to owner", async function () {
      const {
        owner,
        sellToken,
        sellAmount,
        order,
      } = await loadFixture(fixture);

      expect(await sellToken.balanceOf(order.address)).to.equal(sellAmount);
      expect(await sellToken.balanceOf(owner.address)).to.equal(0);

      await order.connect(owner).cancel();

      expect(await sellToken.balanceOf(order.address)).to.equal(0);
      expect(await sellToken.balanceOf(owner.address)).to.equal(sellAmount);
    });

    it("Should unset order hash", async function () {
      const { owner, order } = await loadFixture(fixture);

      await order.connect(owner).cancel();

      expect(await order.orderHash()).to.equal(ethers.constants.HashZero);
    });

    it("Should revert if not called by owner", async function () {
      const { owner, order, bob } = await loadFixture(fixture);

      expect(owner.address).to.not.eq(bob.address);

      await expect(order.connect(bob).cancel()).to.be.revertedWith(
        "not the owner",
      );
    });
  });
});
