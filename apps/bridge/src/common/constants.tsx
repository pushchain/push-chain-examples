import { PushChain } from "@pushchain/core";
import { ArbitrumMonotone, EthereumMonotone, SolanaMonotone, BaseMonotone, BnbMonotone, IllustrationProps, IconProps, Ethereum, Solana, USDT, WEthereum } from "shared-components";

export const chainsIconList: Record<string, React.FC<IconProps>> = {
  [PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA]: EthereumMonotone,
  [PushChain.CONSTANTS.CHAIN.ARBITRUM_SEPOLIA]: ArbitrumMonotone,
  [PushChain.CONSTANTS.CHAIN.BASE_SEPOLIA]: BaseMonotone,
  [PushChain.CONSTANTS.CHAIN.BNB_TESTNET]: BnbMonotone,
  [PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET]: SolanaMonotone,
}

export const tokensIconList: Record<string, React.FC<IllustrationProps>> = {
  ["ETH"]: Ethereum,
  ["USDT"]: USDT,
  ["WETH"]: WEthereum,
  ["SOL"]: Solana,
}