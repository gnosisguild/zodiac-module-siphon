# Zodiac Siphon Module

[![Build Status](https://github.com/gnosis/zodiac-module-siphon/actions/workflows/ci.yml/badge.svg)](https://github.com/gnosis/zodiac-module-siphon/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/gnosis/zodiac-module-siphon/badge.svg?branch=main)](https://coveralls.io/github/gnosis/zodiac-module-siphon)

The Siphon Module belongs to the [Zodiac](https://github.com/gnosis/zodiac) collection of tools, which can be accessed through the Zodiac App available on [Gnosis Safe](https://gnosis-safe.io/).

If you have any questions about Zodiac, join the [Gnosis Guild Discord](https://discord.gg/wwmBWTgyEq). Follow [@GnosisGuild](https://twitter.com/gnosisguild) on Twitter for updates.

### About the Siphon Module

This module is exposes a public interface which allows anyone to trigger an Avatar to withdraw from a designated luiquidity position in order to pay down some of its debt in a designated debt position, thereby improving the health of the position.

The owner of the module can set target and trigger collateral ratios for the debt position. If the collateral ratio of the debt position falls below the trigger ratio, anyone can call `siphon()` to trigger the withdrawal of enough capital from the liquidity position to return the debt position to the target ratio.

This contract should be used in concert with a bot which periodicially queries `ratio()` on the debt position adapter and calls `siphon()` on the Siphon module any time `ratio()` falls below the current `ratioTarget()`.

Siphon also exposes some MEV in the parity and slippage tolerance defined by the user in the liquidity adapter. Setting these variables relatively higher provides an incentive for those seeking to capture MEV to call `siphon()` on the user's behalf, whenever `ratio()` falls below `ratioTarget()`. This could be used in concert with the bot mentioned above to add a layer of redundancy to the monitoring payment of unhealthy debt positions.

### Features

- Pay down debt from assets being productively used elsewhere in one atomic transaction.
- Automate debt repayment via bots and/or MEV to ensure debt positions stay healthy.
- Generalized interface can be adapted for many debt and liquidity positions.
- Use existing adapters to monitor Maker Vaults and pay down debt from capital deployed to Balancer Boosted Stable Pools.

### Flow

- Deploy a debt position adapter along with a liquidity position adapter from which asset to pay down debt can be drawn.
- Set a target collateral ratio and a trigger collateral ratio on the debt position.
- Set parity and slippage tolerance for you liquidity position; higher means exposing more MEV.
- Connect [a tube](https://youtu.be/WqWuwZElgDg) between the debt position and the liquidity position with `connectTube()`.
- Monitor `ratio()` and `ratioTrigger()` on the debt adapter and call `siphon()` on the Siphon module whenever the former falls below the latter.

### Development environment setup

1. Copy the content of the `.env.sampl` file into a `.env` file at the same location and populate it with your keys, etc.
2. From the repo root run `yarn`
3. From the repo root run `yarn build`

### Solidity Compiler

The contracts have been developed with [Solidity 0.8.6](https://github.com/ethereum/solidity/releases/tag/v0.8.6). This version of Solidity made all arithmetic checked by default, therefore eliminating the need for explicit overflow or underflow (or other arithmetic) checks.

### Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

### License

Created under the [LGPL-3.0+ license](LICENSE).