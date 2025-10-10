// SPDX-License-Identifier: MIT
import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("SecretRegistry (N=2, M=2)", function () {
  it("register -> 2x confirm -> canReconstruct -> close", async () => {
    const [owner, p1, p2, outsider] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SecretRegistry");
    const reg = await Factory.deploy();
    await reg.waitForDeployment();

    const secretId = ethers.keccak256(ethers.toUtf8Bytes("secret#demo"));
    const participants = [p1.address, p2.address];
    const M = 2;
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes("super-secret||salt"));

    await expect(reg.connect(owner).registerSecret(secretId, M, participants, secretHash))
      .to.emit(reg, "SecretRegistered");

    await expect(reg.connect(outsider).confirmReceipt(secretId))
      .to.be.revertedWithCustomError(reg, "NotParticipant");

    await expect(reg.connect(p1).confirmReceipt(secretId))
      .to.emit(reg, "ReceiptConfirmed");
    expect(await reg.canReconstruct(secretId)).to.eq(false);

    await expect(reg.connect(p2).confirmReceipt(secretId))
      .to.emit(reg, "ReceiptConfirmed");
    expect(await reg.canReconstruct(secretId)).to.eq(true);

    await expect(reg.connect(owner).closeSecret(secretId))
      .to.emit(reg, "SecretClosed");

    await expect(reg.connect(p1).confirmReceipt(secretId))
      .to.be.revertedWithCustomError(reg, "NotActive");
  });
});

describe("SecretRegistry – edge cases", () => {
  async function deploy() {
    const [owner, p1, p2, outsider] = await ethers.getSigners();
    const F = await ethers.getContractFactory("SecretRegistry");
    const reg = await F.deploy();
    await reg.waitForDeployment();
    return { reg, owner, p1, p2, outsider };
  }

  it("InvalidThreshold: M=0, M>N, empty participants", async () => {
    const { reg, owner, p1 } = await deploy();
    const sid = ethers.keccak256(ethers.toUtf8Bytes("sid-1"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await expect(reg.connect(owner).registerSecret(sid, 0, [p1.address], hash))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold");

    await expect(reg.connect(owner).registerSecret(sid, 2, [p1.address], hash))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold");

    await expect(reg.connect(owner).registerSecret(sid, 1, [], hash))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold");
  });

  it("Provera duplikata i nulte adrese u participants", async () => {
    const { reg, owner, p1 } = await deploy();
    const sid1 = ethers.keccak256(ethers.toUtf8Bytes("dup"));
    const sid2 = ethers.keccak256(ethers.toUtf8Bytes("zero"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await expect(
      reg.connect(owner).registerSecret(sid1, 1, [p1.address, p1.address], hash)
    ).to.be.revertedWith("duplicate participant");

    await expect(
      reg.connect(owner).registerSecret(sid2, 1, [ethers.ZeroAddress], hash)
    ).to.be.revertedWith("zero participant");
  });

  it("AlreadyExists: isti secretId ne može 2x", async () => {
    const { reg, owner, p1 } = await deploy();
    const sid = ethers.keccak256(ethers.toUtf8Bytes("same"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await reg.connect(owner).registerSecret(sid, 1, [p1.address], hash);
    await expect(
      reg.connect(owner).registerSecret(sid, 1, [p1.address], hash)
    ).to.be.revertedWithCustomError(reg, "AlreadyExists");
  });

  it("AlreadyConfirmed: učesnik ne može 2x potvrditi", async () => {
    const { reg, owner, p1 } = await deploy();
    const sid = ethers.keccak256(ethers.toUtf8Bytes("ac"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await reg.connect(owner).registerSecret(sid, 1, [p1.address], hash);
    await reg.connect(p1).confirmReceipt(sid);

    await expect(reg.connect(p1).confirmReceipt(sid))
      .to.be.revertedWithCustomError(reg, "AlreadyConfirmed");
  });

  it("NotOwner: samo owner može close", async () => {
    const { reg, owner, p1 } = await deploy();
    const sid = ethers.keccak256(ethers.toUtf8Bytes("close"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await reg.connect(owner).registerSecret(sid, 1, [p1.address], hash);
    await expect(reg.connect(p1).closeSecret(sid))
      .to.be.revertedWithCustomError(reg, "NotOwner");
  });

  it("UnknownSecret: getSecret revertuje; canReconstruct/isParticipant/hasConfirmed → false", async () => {
    const { reg } = await deploy();
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("unknown"));

    await expect(reg.getSecret(unknown))
      .to.be.revertedWithCustomError(reg, "UnknownSecret");

    expect(await reg.canReconstruct(unknown)).to.eq(false);
    expect(await reg.isParticipant(unknown, ethers.ZeroAddress)).to.eq(false);
    expect(await reg.hasConfirmed(unknown, ethers.ZeroAddress)).to.eq(false);
  });

  it("Events: SecretRegistered i ReceiptConfirmed imaju očekovane argumente", async () => {
    const { reg, owner, p1, p2 } = await deploy();
    const sid = ethers.keccak256(ethers.toUtf8Bytes("ev"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await expect(
      reg.connect(owner).registerSecret(sid, 2, [p1.address, p2.address], hash)
    )
      .to.emit(reg, "SecretRegistered")
      .withArgs(sid, owner.address, 2, 2, hash, anyValue);

    await expect(reg.connect(p1).confirmReceipt(sid))
      .to.emit(reg, "ReceiptConfirmed")
      .withArgs(sid, p1.address, anyValue);
  });

  it("State: active true posle register, false posle close; canReconstruct zavisi od M", async () => {
    const { reg, owner, p1, p2 } = await deploy();
    const sid = ethers.keccak256(ethers.toUtf8Bytes("state"));
    const hash = ethers.keccak256(ethers.toUtf8Bytes("h"));

    await reg.connect(owner).registerSecret(sid, 2, [p1.address, p2.address], hash);
    let s = await reg.getSecret(sid);
    expect(s[3]).to.eq(true); 

    await reg.connect(p1).confirmReceipt(sid);
    expect(await reg.canReconstruct(sid)).to.eq(false); 

    await reg.connect(p2).confirmReceipt(sid);
    expect(await reg.canReconstruct(sid)).to.eq(true);  

    await reg.connect(owner).closeSecret(sid);
    s = await reg.getSecret(sid);
    expect(s[3]).to.eq(false);
  });
});
