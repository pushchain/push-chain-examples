import { expect } from "chai";
import hre from "hardhat";

describe("Counter Contract", function () {
  // Deploy helper function
  async function deployCounter() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const Counter = await hre.ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();

    await counter.waitForDeployment();

    return { counter, owner, otherAccount };
  }

  // -------------------------
  // Deployment Tests
  // -------------------------
  describe("Deployment", function () {
    it("Should initialize count to 0", async function () {
      const { counter } = await deployCounter();

      const count = await counter.countPC();
      expect(count).to.equal(0);
    });
  });

  // -------------------------
  // Increment Tests
  // -------------------------
  describe("Increment Function", function () {
    it("Should increment the counter", async function () {
      const { counter } = await deployCounter();

      await counter.increment();

      const count = await counter.countPC();
      expect(count).to.equal(1);
    });

    it("Should increment multiple times correctly", async function () {
      const { counter } = await deployCounter();

      await counter.increment();
      await counter.increment();
      await counter.increment();

      const count = await counter.countPC();
      expect(count).to.equal(3);
    });

    it("Should emit CountIncremented event with correct values", async function () {
      const { counter, owner } = await deployCounter();

      await expect(counter.increment())
        .to.emit(counter, "CountIncremented")
        .withArgs(1, owner.address);
    });

    it("Should allow any user to increment", async function () {
      const { counter, otherAccount } = await deployCounter();

      await counter.connect(otherAccount).increment();

      const count = await counter.countPC();
      expect(count).to.equal(1);
    });

    it("Should keep correct state across different users", async function () {
      const { counter, owner, otherAccount } = await deployCounter();

      await counter.connect(owner).increment();       // count = 1
      await counter.connect(otherAccount).increment(); // count = 2

      const count = await counter.countPC();
      expect(count).to.equal(2);
    });
  });
});