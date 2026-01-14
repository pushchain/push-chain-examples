import { PushUI, PushUniversalWalletProvider, type AppMetadata, type ProviderConfigProps } from '@pushchain/ui-kit'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Airdrop Owner Wallet Instance
const deployerWalletConfig: ProviderConfigProps = {
  uid: 'AirdropDeployer',
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  login: {
    email: true,
    google: true,
    wallet: {
      enabled: true,
    },
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
      "eip155:11155111": ["https://sepolia.gateway.tenderly.co/"],
    },
  },
};

// Airdrop Claimer Wallet Instance
const claimerWalletConfig: ProviderConfigProps = {
  uid: 'AirdropClaimer',
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  login: {
    email: true,
    google: true,
    wallet: {
      enabled: true,
    },
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
      "eip155:11155111": ["https://sepolia.gateway.tenderly.co/"],
    },
  },
};

const appMetadata: AppMetadata = {
  logoUrl: "https://avatars.githubusercontent.com/u/64157541?v=4",
  title: "Universal Claimable Airdrop",
  description: "Push Chain is a shared state L1 blockchain that allows all chains to unify, enabling apps of any chain to be accessed by users of any chain.",
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PushUniversalWalletProvider config={deployerWalletConfig} app={appMetadata}>
      <PushUniversalWalletProvider config={claimerWalletConfig} app={appMetadata}>
        <App />
      </PushUniversalWalletProvider>
    </PushUniversalWalletProvider>
  </StrictMode>,
)