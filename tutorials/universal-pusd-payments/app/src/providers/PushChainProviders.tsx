import {
  PushUI,
  PushUniversalWalletProvider,
  type AppMetadata,
  type ProviderConfigProps,
} from '@pushchain/ui-kit';

/**
 * PushChainProviders — wraps the app with the Push Universal Wallet so any
 * user (Ethereum, Solana, BNB, native Push, etc.) can connect with a single
 * button. Configured for Donut Testnet.
 */
const PushChainProviders = ({ children }: { children: React.ReactNode }) => {
  const walletConfig: ProviderConfigProps = {
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,

    login: {
      email: true,
      google: true,
      wallet: { enabled: true },
      appPreview: true,
    },

    modal: {
      loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
      connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
      appPreview: true,
      connectedInteraction: PushUI.CONSTANTS.CONNECTED.INTERACTION.BLUR,
    },

    chainConfig: {
      rpcUrls: {
        'eip155:11155111': ['https://sepolia.gateway.tenderly.co/'],
      },
    },
  };

  const appMetadata: AppMetadata = {
    logoUrl: 'https://avatars.githubusercontent.com/u/64157541?v=4',
    title: 'PUSD Paywall',
    description:
      'A demo paywall that accepts PUSD from any chain — pay 1 PUSD, get 30 days of access.',
  };

  return (
    <PushUniversalWalletProvider config={walletConfig} app={appMetadata}>
      {children}
    </PushUniversalWalletProvider>
  );
};

export { PushChainProviders };
