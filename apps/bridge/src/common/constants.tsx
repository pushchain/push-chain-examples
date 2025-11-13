import { PushChain } from "@pushchain/core";
import { ArbitrumMonotone, EthereumMonotone, SolanaMonotone, BaseMonotone, BnbMonotone, IconProps } from "shared-components";

export const chainsIconList: Record<string, React.FC<IconProps>> = {
  [PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA]: EthereumMonotone,
  [PushChain.CONSTANTS.CHAIN.ARBITRUM_SEPOLIA]: ArbitrumMonotone,
  [PushChain.CONSTANTS.CHAIN.BASE_SEPOLIA]: BaseMonotone,
  [PushChain.CONSTANTS.CHAIN.BNB_TESTNET]: BnbMonotone,
  [PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET]: SolanaMonotone,
}