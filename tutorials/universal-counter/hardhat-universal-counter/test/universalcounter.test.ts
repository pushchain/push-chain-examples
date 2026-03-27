import { expect } from "chai";
import hre from "hardhat";

describe("UniversalCounter Contract", function () {

  async function deployUniversalCounter() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    // 🧪 Deploy Mock UEA Factory
    const MockFactory = await hre.ethers.getContractFactory("MockUEAFactory");
    const mockFactory = await MockFactory.deploy();
    await mockFactory.waitForDeployment();

    // 🧪 Deploy UniversalCounter
    const UniversalCounter = await hre.ethers.getContractFactory("UniversalCounter");
    const counter = await UniversalCounter.deploy();
    await counter.waitForDeployment();

    return { counter, owner, otherAccount, mockFactory };
  }

  // -------------------------
  // Deployment
  // -------------------------
  describe("Deployment", function () {
    it("Should initialize all counters to 0", async function () {
      const { counter } = await deployUniversalCounter();

      expect(await counter.countPC()).to.equal(0);
      expect(await counter.countEth()).to.equal(0);
      expect(await counter.countSol()).to.equal(0);
    });
  });

  // -------------------------
  // Push Chain (EOA)
  // -------------------------
  describe("Push Chain Users", function () {
    it("Should increment countPC for native users", async function () {
      const { counter } = await deployUniversalCounter();

      await counter.increment();

      expect(await counter.countPC()).to.equal(1);
    });
  });

  // -------------------------
  // Ethereum Users
  // -------------------------
  describe("Ethereum UEA Users", function () {
    it("Should increment countEth", async function () {
      const { counter, mockFactory, owner } = await deployUniversalCounter();

      // Mock Ethereum user
      await mockFactory.setUEA(
        owner.address,
        "eip155",
        "11155111",
        true
      );

      await counter.increment();

      expect(await counter.countEth()).to.equal(1);
    });
  });

  // -------------------------
  // Solana Users
  // -------------------------
  describe("Solana UEA Users", function () {
    it("Should increment countSol", async function () {
      const { counter, mockFactory, owner } = await deployUniversalCounter();

      await mockFactory.setUEA(
        owner.address,
        "solana",
        "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        true
      );

      await counter.increment();

      expect(await counter.countSol()).to.equal(1);
    });
  });

  // -------------------------
  // Invalid Chain
  // -------------------------
  describe("Invalid Chain", function () {
    it("Should revert for unsupported chains", async function () {
      const { counter, mockFactory, owner } = await deployUniversalCounter();

      await mockFactory.setUEA(
        owner.address,
        "unknown",
        "123",
        true
      );

      await expect(counter.increment()).to.be.revertedWith("Invalid chain");
    });
  });

  // -------------------------
  // Total Count
  // -------------------------
  describe("Total Count", function () {
    it("Should return correct total count", async function () {
      const { counter } = await deployUniversalCounter();

      await counter.increment();
      await counter.increment();

      expect(await counter.getCount()).to.equal(2);
    });
  });
});