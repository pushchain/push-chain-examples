import { PushChain } from "@pushchain/core";
import { PROGRESS_HOOK } from "@pushchain/core/src/lib/progress-hook/progress-hook.types";
import { ArbitrumMonotone, EthereumMonotone, SolanaMonotone, BaseMonotone, BnbMonotone, IllustrationProps, IconProps, Ethereum, Solana, USDT, WEthereum, PushMonotone, USDC, StEthereum, Push } from "shared-components";
import { defineChain } from "viem";
import { mainnet, sepolia, baseSepolia, arbitrumSepolia, bscTestnet } from 'viem/chains';

export const pushTestnetChain = defineChain({
    id: 42101,
    name: 'Push Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'PUSH',
        symbol: 'PUSH',
    },
    rpcUrls: {
        default: {
            http: ['https://evm.donut.rpc.push.org/'],
            webSocket: ['wss://evm.pn1.dev.push.org'],
        },
        public: {
            http: ['https://evm.donut.rpc.push.org/'],
            webSocket: ['wss://evm.pn1.dev.push.org'],
        },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://donut.push.network/' },
    },
})

export const chainsIconList: Record<string, React.FC<IconProps>> = {
  [PushChain.CONSTANTS.CHAIN.ETHEREUM_SEPOLIA]: EthereumMonotone,
  [PushChain.CONSTANTS.CHAIN.ARBITRUM_SEPOLIA]: ArbitrumMonotone,
  [PushChain.CONSTANTS.CHAIN.BASE_SEPOLIA]: BaseMonotone,
  [PushChain.CONSTANTS.CHAIN.BNB_TESTNET]: BnbMonotone,
  [PushChain.CONSTANTS.CHAIN.SOLANA_DEVNET]: SolanaMonotone,
  [PushChain.CONSTANTS.CHAIN.PUSH_TESTNET_DONUT]: PushMonotone,
}

export const tokensIconList: Record<string, React.FC<IllustrationProps>> = {
  ["ETH"]: Ethereum,
  ["USDT"]: USDT,
  ["WETH"]: WEthereum,
  ["SOL"]: Solana,
  ["USDC"]: USDC,
  ["stETH"]: StEthereum,
  ["PC"]: Push,
}

export const EVM_CHAIN_CONFIGS = {
  1: mainnet,
  11155111: sepolia,
  84532: baseSepolia,
  421614: arbitrumSepolia,
  97: bscTestnet,
  42101: pushTestnetChain,
};

export const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
];

export const NETWORK_NAME_MAP: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  bsc: "BSC",
  pc: "Push Chain",
};

export const getBaseSymbol = (symbol: string) => symbol.split(".")[0] ?? symbol;

export const getNetworkKey = (symbol: string) => symbol.split(".")[1];

export const getNetworkNameFromSymbol = (symbol: string) => {
  const network = getNetworkKey(symbol);
  if (!network) return "";
  return NETWORK_NAME_MAP[network] ?? network.toUpperCase();
};

export const createTokenName = (symbol: string): string => {
  const base = getBaseSymbol(symbol);
  const networkName = getNetworkNameFromSymbol(symbol);

  if (!networkName) return base;
  return `${networkName} Bridged ${base} `;
};

export const TOKENS = [
  {
    symbol: "pETH",
    address: "0x2971824Db68229D087931155C2b8bB820B275809",
    decimals: 18,
    mechanism: "approve",
    name: "Bridged Ethereum",
    logoKey: "ETH",
    chainBadge: "PC",
    chainName: "eth",
  },
  {
    symbol: "pETH_ARB",
    address: "0xc0a821a1AfEd1322c5e15f1F4586C0B8cE65400e",
    decimals: 18,
    mechanism: "approve",
    name: createTokenName("ETH.arb"),
    logoKey: "ETH",
    chainBadge: "PC",
    chainName: "arb",
  },
  {
    symbol: "pETH_BASE",
    address: "0xc7007af2B24D4eb963fc9633B0c66e1d2D90Fc21",
    name: createTokenName("ETH.base"),
    decimals: 18,
    logoKey: "ETH",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "base",
  },
  {
    symbol: "pBNB",
    address: "0x7a9082dA308f3fa005beA7dB0d203b3b86664E36",
    name: createTokenName("ETH.bnb"),
    decimals: 18,
    logoKey: "ETH",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "bsc",
  },
  {
    symbol: "pSOL",
    address: "0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed",
    name: "Bridged Solana",
    decimals: 9,
    logoKey: "SOL",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "sol",
  },
  {
    symbol: "USDT",
    address: "0xCA0C5E6F002A389E1580F0DB7cd06e4549B5F9d3",
    name: createTokenName("USDT.eth"),
    decimals: 6,
    logoKey: "USDT",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "eth",
  },
  {
    symbol: "USDT",
    address: "0x76Ad08339dF606BeEDe06f90e3FaF82c5b2fb2E9",
    name: createTokenName("USDT.arb"),
    decimals: 6,
    logoKey: "USDT",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "arb",
  },
  {
    symbol: "USDT",
    address: "0x2C455189D2af6643B924A981a9080CcC63d5a567",
    name: createTokenName("USDT.base"),
    decimals: 6,
    logoKey: "USDT",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "base",
  },
  {
    symbol: "USDT",
    address: "0x2f98B4235FD2BA0173a2B056D722879360B12E7b",
    name: createTokenName("USDT.bsc"),
    decimals: 6,
    logoKey: "USDT",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "bsc",
  },
  {
    symbol: "USDT",
    address: "0x4f1A3D22d170a2F4Bddb37845a962322e24f4e34",
    name: createTokenName("USDT.sol"),
    decimals: 6,
    logoKey: "USDT",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "sol",
  },
  {
    symbol: "USDC",
    address: "0x7A58048036206bB898008b5bBDA85697DB1e5d66",
    name: createTokenName("USDC.eth"),
    decimals: 6,
    logoKey: "USDC",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "eth",
  },
  {
    symbol: "USDC",
    address: "0x1091cCBA2FF8d2A131AE4B35e34cf3308C48572C",
    name: createTokenName("USDC.arb"),
    decimals: 6,
    logoKey: "USDC",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "arb",
  },
  {
    symbol: "USDC",
    address: "0xD7C6cA1e2c0CE260BE0c0AD39C1540de460e3Be1",
    name: createTokenName("USDC.bsc"),
    decimals: 6,
    logoKey: "USDC",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "bsc",
  },
  {
    symbol: "USDC",
    address: "0x04B8F634ABC7C879763F623e0f0550a4b5c4426F",
    name: createTokenName("USDC.sol"),
    decimals: 6,
    logoKey: "USDC",
    chainBadge: "PC",
    mechanism: "approve",
    chainName: "sol",
  },
];

export const VERIFICATION_SUCCESS_IDS: ReadonlyArray<string> = [
    PROGRESS_HOOK.SEND_TX_104_03,
    PROGRESS_HOOK.SEND_TX_204_03,
    PROGRESS_HOOK.SEND_TX_304_03,
];

export const SUCCESS_IDS: ReadonlyArray<string> = [
    PROGRESS_HOOK.SEND_TX_199_01,
    PROGRESS_HOOK.SEND_TX_299_01,
    PROGRESS_HOOK.SEND_TX_399_01,
    PROGRESS_HOOK.SEND_TX_999_01,
    PROGRESS_HOOK.UEA_MIG_9901,
];