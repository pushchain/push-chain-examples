import { ethers } from "ethers";
import { Address, createPublicClient, defineChain, erc20Abi, formatUnits, http } from "viem";
import { Contract, JsonRpcProvider } from 'ethers';
import { EVM_CHAIN_CONFIGS, PRC20_TOKENS } from "./constants";
import { CHAIN } from "@pushchain/core/src/lib/constants/enums";
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { UniversalAccount } from "@pushchain/ui-kit";
import { MoveableToken } from "@pushchain/core/src/lib/constants";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const provider = new JsonRpcProvider("https://evm.donut.rpc.push.org/");

const ERC20_ABI = [
  "function symbol() view returns (string)",
];

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

export function enumKeyToDisplay(key: string): string {
  const parts = key.split("_");
  const last = parts[parts.length - 1];
  if (parts.length > 2) {
    parts.pop();
    return `${titleCase(parts.join(" "))} (${titleCase(last)})`;
  }
  return titleCase(parts.join(" "));
}

export async function fetchNativeBalance(address: string) {
  const RPC = "https://evm.donut.rpc.push.org/";
  const provider = new ethers.JsonRpcProvider(RPC);
  if (!ethers.isAddress(address)) throw new Error("Invalid address");
  const balance = await provider.getBalance(address);
  const balanceInPC = ethers.formatEther(balance);
  return balanceInPC;
}

type fetchTokenBalanceProps = {
    walletAddress: Address,
    tokenAddress?: Address,
    decimals: number
}

type fetchNativeTokenBalanceProps = {
    wallet: UniversalAccount,
    token: MoveableToken,
}

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
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://donut.push.network/' },
    },
})

export const getChainIdFromChain = (
  chain: CHAIN
): number | null => {
  const [namespace, reference] = chain.split(":");

  // EVM chains → eip155:<chainId>
  if (namespace === "eip155") {
    const id = Number(reference);
    return Number.isFinite(id) ? id : null;
  }

  // Solana chains → no numeric chainId
  if (namespace === "solana") {
    return null;
  }

  return null;
};

export const fetchNativeTokenBalance = async ({
  wallet,
  token
}: fetchNativeTokenBalanceProps) => {
  if (!wallet || !token) {
    return '0';
  }

  try {
    if (wallet.chain === CHAIN.SOLANA_DEVNET || !wallet.chain) {
      // Solana
      const network = 'devnet';
      const connection = new Connection(clusterApiUrl(network));
      const publicKey = new PublicKey(wallet.address);
      const lamports = await connection.getBalance(publicKey);
      const sol = lamports / 1e9;
      return sol.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else {
      // EVM
      const chainId = getChainIdFromChain(wallet.chain);
      if (!chainId) {
        return '0';
      }
      const chain = EVM_CHAIN_CONFIGS[chainId as keyof typeof EVM_CHAIN_CONFIGS];
      const client = createPublicClient({ chain, transport: http() });
      const wei = await client.getBalance({ address:  wallet.address as `0x${string}` });
      const eth = Number(wei) / 1e18;
      return eth.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  } catch (err) {
    console.error('Error fetching native token balance:', err);
    return '0';
  }
}

export const fetchErc20TokenBalance = async ({
  wallet,
  token,
}: fetchNativeTokenBalanceProps) => {
  const chainId = getChainIdFromChain(wallet.chain);
  const chain = EVM_CHAIN_CONFIGS[chainId as keyof typeof EVM_CHAIN_CONFIGS];
  const client = createPublicClient({ chain, transport: http() });

  const [raw, dec] = await Promise.all([
    client.readContract({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet.address as `0x${string}`],
    }),
    token.decimals ??
      client.readContract({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      }),
  ]);

  return formatUnits(raw, Number(dec));
};

export const fetchSplTokenBalance = async ({
  owner,
  mint,
  rpcUrl = "https://api.devnet.solana.com",
}: {
  owner: string;
  mint: string;
  rpcUrl?: string;
}) => {
  const conn = new Connection(rpcUrl);
  const ownerPk = new PublicKey(owner);
  const mintPk = new PublicKey(mint);

  const ata = await getAssociatedTokenAddress(mintPk, ownerPk);
  const res = await conn.getTokenAccountBalance(ata).catch(() => null);

  return res?.value?.uiAmountString ?? "0";
};

export const fetchPrc20TokenBalance = async ({
    walletAddress,
    tokenAddress,
    decimals
}: fetchTokenBalanceProps) => {
    const publicClient = createPublicClient({
        chain: pushTestnetChain,
        transport: http(),
    });

    try {
        if (!tokenAddress) {
            const nativeBalance = await publicClient.getBalance({ address: walletAddress });
            return formatUnits(nativeBalance, decimals);
        }

        const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress],
        });

        return formatUnits(balance as bigint, decimals);
    } catch (error) {
        console.error('Error fetching token balance:', error);
        throw new Error('Error fetching token balance:')
    }
}

export function formatTxTime(
  dateLike: number | string | Date,
  timeZone?: string
) {
  const d = new Date(dateLike);
  const fmt = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });

  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));

  return `${parts.day} ${parts.month} ${parts.year} - ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export const getTokenSymbol = async (tokenAddress: string) => {
  try {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    return await contract.symbol();
  } catch (e) {
    console.error("symbol() failed", e);
    return null;
  }
}

type SourceChain = typeof PRC20_TOKENS[number]['sourceChain'];
type TokenSymbol = typeof PRC20_TOKENS[number]['symbol'];

export const getPrc20Address = (
  symbol: TokenSymbol,
  sourceChain: SourceChain
): string | null => {
  return (
    PRC20_TOKENS.find(
      (t) => t.symbol === symbol && t.sourceChain === sourceChain
    )?.prc20Address ?? null
  );
};