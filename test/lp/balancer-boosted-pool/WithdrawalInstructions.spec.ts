import { expect } from "chai";
import { BigNumber } from "ethers";
import hre, { deployments, getNamedAccounts } from "hardhat";

import { BOOSTED_GAUGE_TOP_HOLDERS, DAI_ADDRESS } from "../constants";
import { fork, forkReset } from "../setup";

import { setup, setupFundWhale, setupFundAvatar } from "./setup";

describe("LP: Balancer Boosted Pool", async () => {
  describe("withdrawalInstructions", async () => {
    let baseSetup: any;

    before(async () => {
      await fork(15582929);

      baseSetup = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();

        const {
          avatar,
          adapter,
          pool,
          gauge,
          dai,
          boostedPoolHelper,
          stablePhantomPoolHelper,
        } = await setup();

        await setupFundWhale(BOOSTED_GAUGE_TOP_HOLDERS);

        await setupFundAvatar(
          avatar,
          BigNumber.from("1000000000000000000000000"),
          BigNumber.from("1000000000000000000000000")
        );

        return {
          avatar,
          adapter,
          pool,
          gauge,
          dai,
          boostedPoolHelper,
          stablePhantomPoolHelper,
        };
      });
    });

    after(async () => {
      await forkReset();
    });

    it("Withdrawing more than available balance yields full exit - outGivenIn", async () => {
      const { avatar, adapter, pool, gauge, dai, boostedPoolHelper } =
        await baseSetup();

      const avatarBptBalance = BigNumber.from("1000000000000000000000000");
      const avatarGaugeBalance = BigNumber.from("1000000000000000000000000");
      const adapterLiquidity = BigNumber.from("2029247134262182408154990");

      // Avatar has zero DAI
      expect(await dai.balanceOf(avatar.address)).to.equal(0);

      expect(await pool.balanceOf(avatar.address)).to.equal(avatarBptBalance);

      expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );

      expect(await adapter.callStatic.balance()).to.equal(adapterLiquidity);

      // requesting 10x more than available
      const requestedAmountOut = adapterLiquidity.mul(10);

      const instructions = await adapter.callStatic.withdrawalInstructions(
        requestedAmountOut
      );

      expect(instructions).to.have.length(2);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      await avatar.exec(
        instructions[1].to,
        instructions[1].value.toString(),
        instructions[1].data
      );

      // Expect BPT and StakedBPT to be drained
      await expect(await pool.balanceOf(avatar.address)).to.equal(
        BigNumber.from("0")
      );

      await expect(await gauge.balanceOf(avatar.address)).to.equal(
        BigNumber.from("0")
      );

      const calculatedAmountOut =
        await boostedPoolHelper.callStatic.calcStableOutGivenBptIn(
          pool.address,
          avatarBptBalance.add(avatarGaugeBalance),
          DAI_ADDRESS
        );

      const actualAmountOut = await dai.balanceOf(avatar.address);

      const left = actualAmountOut.div(10000).mul(9999);
      const right = actualAmountOut.div(10000).mul(10001);

      expect(calculatedAmountOut.gt(left) && actualAmountOut.lt(right)).to.be
        .true;
    });

    it("Withdrawing with requested amountOut close to balance yields full exit - outGivenIn", async () => {
      const { avatar, adapter, pool, gauge, dai } = await baseSetup();

      const avatarBptBalance = BigNumber.from("1000000000000000000000000");
      const avatarGaugeBalance = BigNumber.from("1000000000000000000000000");
      const adapterLiquidity = BigNumber.from("2029247134262182408154990");

      // Avatar has zero DAI
      await expect(await dai.balanceOf(avatar.address)).to.equal(0);

      await expect(await pool.balanceOf(avatar.address)).to.equal(
        avatarBptBalance
      );
      await expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );
      await expect(await adapter.callStatic.balance()).to.equal(
        adapterLiquidity
      );

      // withdrawing slightly less than available, should yield full exit
      const requestedAmountOut = adapterLiquidity.div(1000).mul(999);

      const instructions = await adapter.callStatic.withdrawalInstructions(
        requestedAmountOut
      );

      expect(instructions).to.have.length(2);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      await avatar.exec(
        instructions[1].to,
        instructions[1].value.toString(),
        instructions[1].data
      );

      // Expect BPT and StakedBPT to be drained
      await expect(await pool.balanceOf(avatar.address)).to.equal(0);

      await expect(await gauge.balanceOf(avatar.address)).to.equal(0);

      const actualAmountOut = await dai.balanceOf(avatar.address);
      expect(actualAmountOut).to.gte(requestedAmountOut);
    });

    it("Withdrawing with partial unstake - inGivenOut", async () => {
      // getting ~75% of liquidity should yield a partial withdrawal,
      // since we start with 50/50 stake and unstaked bpt
      const { avatar, adapter, pool, gauge, dai } = await baseSetup();

      const avatarBptBalance = BigNumber.from("1000000000000000000000000");
      const avatarGaugeBalance = BigNumber.from("1000000000000000000000000");
      const adapterLiquidity = BigNumber.from("2029247134262182408154990");

      // Avatar has zero DAI
      expect(await dai.balanceOf(avatar.address)).to.equal(0);

      expect(await pool.balanceOf(avatar.address)).to.equal(avatarBptBalance);

      expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );

      expect(await adapter.callStatic.balance()).to.equal(adapterLiquidity);

      // roughly 75% of what's available in the liquidity position
      const requestedAmountOut = adapterLiquidity.div(100).mul(75);

      const instructions = await adapter.callStatic.withdrawalInstructions(
        requestedAmountOut
      );

      expect(instructions).to.have.length(2);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      await avatar.exec(
        instructions[1].to,
        instructions[1].value.toString(),
        instructions[1].data
      );

      // We expect the avatar to have exactly the required DAI
      await expect(await dai.balanceOf(avatar.address)).to.equal(
        requestedAmountOut
      );

      // we expect round about half of the STAKED BPT to remain staked
      expect(
        (await gauge.balanceOf(avatar.address)).gt(
          avatarGaugeBalance.div(100).mul(49)
        ) &&
          (await gauge.balanceOf(avatar.address)).lt(
            avatarGaugeBalance.div(100).mul(51)
          )
      ).to.be.true;

      const bptAmountSwapped = BigNumber.from("1500000000000000000000000");
      const maxBptLeftovers = bptAmountSwapped.div(100);

      await expect((await pool.balanceOf(avatar.address)).lt(maxBptLeftovers))
        .to.be.true;
    });

    it("Withdrawing with no unstake - inGivenOut", async () => {
      const { avatar, adapter, dai, pool, gauge } = await baseSetup();

      const avatarBptBalance = BigNumber.from("1000000000000000000000000");
      const avatarGaugeBalance = BigNumber.from("1000000000000000000000000");
      const adapterLiquidity = BigNumber.from("2029247134262182408154990");

      // Avatar has zero DAI
      await expect(await dai.balanceOf(avatar.address)).to.equal(0);

      await expect(await pool.balanceOf(avatar.address)).to.equal(
        avatarBptBalance
      );

      await expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );

      await expect(await adapter.callStatic.balance()).to.equal(
        adapterLiquidity
      );

      // 10% of what's available
      const requestedAmountOut = adapterLiquidity.div(100).mul(10);

      const instructions = await adapter.callStatic.withdrawalInstructions(
        requestedAmountOut
      );

      // No unstaking needed
      expect(instructions).to.have.length(1);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      // We expect the avatar to have exactly the DAI required
      await expect(await dai.balanceOf(avatar.address)).to.equal(
        requestedAmountOut
      );

      // we expected staked BPT to remain unchanged
      await expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );
      // approximation: 10% of balance requested, that's 20% of unstaked used
      const bptUsed = avatarBptBalance.div(100).mul(20);
      // approximation plus slippage
      const bptUsedMore = bptUsed.div(1000).mul(1005);
      // approximation less slippage
      const bptUsedLess = bptUsed.div(1000).mul(995);

      const bptUnusedUpper = avatarBptBalance.sub(bptUsedLess);
      const bptUnusedLower = avatarBptBalance.sub(bptUsedMore);

      await expect(
        (await pool.balanceOf(avatar.address)).gt(bptUnusedLower) &&
          (await pool.balanceOf(avatar.address)).lt(bptUnusedUpper)
      ).to.be.true;
    });

    it("Requesting more DAI than available, and not enough BPT to cover", async () => {
      const { avatar, adapter, pool, gauge, dai, boostedPoolHelper } =
        await baseSetup();

      const avatarBptBalance = BigNumber.from("1000000000000000000000000");
      const avatarGaugeBalance = BigNumber.from("1000000000000000000000000");
      const adapterLiquidity = BigNumber.from("2029247134262182408154990");
      const daiBalanceInPool = BigNumber.from("4688641130857217794578086");

      // Avatar has zero DAI
      expect(await dai.balanceOf(avatar.address)).to.equal(0);

      expect(await pool.balanceOf(avatar.address)).to.equal(avatarBptBalance);

      expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );

      expect(await adapter.callStatic.balance()).to.equal(adapterLiquidity);

      expect(
        await boostedPoolHelper.liquidStableBalance(pool.address, dai.address)
      ).to.equal(daiBalanceInPool);

      const instructions = await adapter.callStatic.withdrawalInstructions(
        daiBalanceInPool.mul(2)
      );

      expect(instructions).to.have.length(2);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      await avatar.exec(
        instructions[1].to,
        instructions[1].value.toString(),
        instructions[1].data
      );

      // Expect BPT and StakedBPT to be drained
      await expect(await pool.balanceOf(avatar.address)).to.equal(
        BigNumber.from("0")
      );

      await expect(await gauge.balanceOf(avatar.address)).to.equal(
        BigNumber.from("0")
      );

      const outLiquidityUpper = adapterLiquidity.div(1000).mul(1005);
      const outLiquidityLower = adapterLiquidity.div(1000).mul(995);

      const actualAmountOut = await dai.balanceOf(avatar.address);

      // expect the amountOut to be around what was forecasted
      expect(
        actualAmountOut.gt(outLiquidityLower) &&
          actualAmountOut.lt(outLiquidityUpper)
      ).to.be.true;
    });

    it("Requesting more DAI than available, as a mega whale, draining LinearPool", async () => {
      const { avatar, adapter, pool, gauge, dai, boostedPoolHelper } =
        await baseSetup();

      const { BigWhale } = await getNamedAccounts();
      const signer = hre.ethers.provider.getSigner(BigWhale);

      const avatarBptBalance = BigNumber.from("1000000000000000000000000");
      const avatarGaugeBalance = BigNumber.from("1000000000000000000000000");
      const daiBalanceInPool = BigNumber.from("4688641130857217794578086");
      const requestedAmountOut = BigNumber.from("9000000000000000000000000");

      const whaleBptBalance = await pool.balanceOf(BigWhale);
      pool.connect(signer).transfer(avatar.address, whaleBptBalance);

      // Avatar has zero DAI
      expect(await dai.balanceOf(avatar.address)).to.equal(0);

      expect(await pool.balanceOf(avatar.address)).to.equal(
        avatarBptBalance.add(whaleBptBalance)
      );

      expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );

      expect(
        await boostedPoolHelper.liquidStableBalance(pool.address, dai.address)
      ).to.equal(daiBalanceInPool);

      // request for more than actually lives in the linearPool.
      // Avatar has around 80% of the pool tokens, so nominally
      // enough for the requested amount
      const instructions = await adapter.callStatic.withdrawalInstructions(
        requestedAmountOut
      );

      // no need to unstake
      expect(instructions).to.have.length(1);

      await avatar.exec(
        instructions[0].to,
        instructions[0].value.toString(),
        instructions[0].data
      );

      // Expect BPT to not be drained
      expect((await pool.balanceOf(avatar.address)).gt(0)).to.be.true;
      // we expected staked BPT to remain unchanged
      expect(await gauge.balanceOf(avatar.address)).to.equal(
        avatarGaugeBalance
      );

      const actualAmountOut = await dai.balanceOf(avatar.address);

      // expect the amountOut to be exactly what was requested
      expect(actualAmountOut).to.equal(daiBalanceInPool);
    });
  });
});
