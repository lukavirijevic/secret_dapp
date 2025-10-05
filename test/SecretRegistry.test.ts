import { expect } from "chai";
import { ethers } from "hardhat";

describe("SecretRegistry", function () {
  it("register/confirm/close flow", async () => {
    const [owner, p1, p2, p3, outsider] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SecretRegistry");
    const reg = await Factory.deploy();
    await reg.waitForDeployment();

    const secretId = ethers.keccak256(ethers.toUtf8Bytes("secret#1"));
    const participants = [p1.address, p2.address, p3.address];
    const M = 2;
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes("super-secret||salt"));

    await expect(reg.connect(owner).registerSecret(secretId, M, participants, secretHash))
      .to.emit(reg, "SecretRegistered");

    await expect(reg.connect(outsider).confirmReceipt(secretId))
      .to.be.revertedWithCustomError(reg, "NotParticipant");

    await expect(reg.connect(p1).confirmReceipt(secretId))
      .to.emit(reg, "ReceiptConfirmed");
    await expect(reg.connect(p2).confirmReceipt(secretId))
      .to.emit(reg, "ReceiptConfirmed");

    expect(await reg.canReconstruct(secretId)).to.eq(true);

    await expect(reg.connect(owner).closeSecret(secretId))
      .to.emit(reg, "SecretClosed");

    await expect(reg.connect(p3).confirmReceipt(secretId))
      .to.be.revertedWithCustomError(reg, "NotActive");
  });
});
