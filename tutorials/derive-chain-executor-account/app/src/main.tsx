import {
  PushUI,
  PushUniversalWalletProvider,
  type AppMetadata,
  type ProviderConfigProps,
} from "@pushchain/ui-kit";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
};

const appMetadata: AppMetadata = {
  logoUrl: "https://avatars.githubusercontent.com/u/64157541?v=4",
  title: "Derive Chain Executor Account",
  description:
    "Derive the Chain Executor Accounts (CEAs) that any Push Chain wallet controls on every supported external chain.",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PushUniversalWalletProvider config={walletConfig} app={appMetadata}>
      <App />
    </PushUniversalWalletProvider>
  </StrictMode>
);
