import { ethers } from "ethers";
import { Address, createPublicClient, defineChain, erc20Abi, formatUnits, http } from "viem";

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

export const fetchTokenBalance = async ({
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