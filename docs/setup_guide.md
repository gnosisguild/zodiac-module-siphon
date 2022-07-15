# Setup Guide: Zodiac Siphon Module

This document will guide you through the setup of the Zodiac Siphon Module.

This module is exposes a public interface which allows anyone to trigger an Avatar to withdraw from a designated luiquidity position in order to pay down some of its debt in a designated debt position, thereby improving the health of the debt position.

The Siphon Module belongs to the [Zodiac](https://github.com/gnosis/zodiac) collection of tools. If you have any questions about Zodiac, join the [Gnosis Guild Discord](https://discord.gg/gnosisguild). Follow [@GnosisGuild](https://twitter.com/gnosisguild) on Twitter for updates.

## Prerequisites

To start the process, you need to create a [Gnosis Safe](https://gnosis-safe.io/app) on the Goerli testnetwork. This safe will hold your MakerDAO CDP and Balancer LP.

For the hardhat tasks to work, the environment needs to be properly configured. See the [sample env file](../.env.sample) for more information.

This guide will use the Goerli deployments of [MakerDAO](https://chainlog.makerdao.com/api/goerli/active.json) and [Balancer](https://etherscan.io/address/0xBA12222222228d8Ba445958a75a0704d566BF2C8#code).

You will need a maker vault owned by your safe, which can easily created using the [Oasis App](https://oasis.app/?network=goerli) (note that you must have `?network=goerli` in the URL for the Oasis app to work on the Goerli testnet).

Your safe will also need some LP tokens in a Balancer Boosted Stable Pool which includes Dai, use the [Balancer App]() to deposit some of the Dai you minted into the Boosted Stable Pool.

Now you're ready to set up your module!
