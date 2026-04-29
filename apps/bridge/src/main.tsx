import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { getBlocksCSSVariables, themeConfig } from 'shared-components';
import {
  PushUI,
  PushUniversalWalletProvider,
  ProviderConfigProps,
} from '@pushchain/ui-kit';
import './index.css'

const GlobalStyle = createGlobalStyle`
  :root{
    /* Font Family */
      --font-family: 'FK Grotesk Neu';

    /* New blocks theme css variables*/
  
    ${(props) => {
      // @ts-expect-error - fix default theme type error
      return getBlocksCSSVariables(props.theme.blocksTheme);
    }}
  }
`;

const walletConfig: ProviderConfigProps = {
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
  login: {
    appPreview: true,
  },
  modal: {
    connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
    appPreview: true,
    connectedInteraction: PushUI.CONSTANTS.CONNECTED.INTERACTION.BLUR,
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={themeConfig.dark}>
      <GlobalStyle />
      <PushUniversalWalletProvider
        config={walletConfig}
        themeMode={PushUI.CONSTANTS.THEME.LIGHT}
        themeOverrides={{
          '--pw-core-font-family': 'FK Grotesk Neu',
          '--pwauth-btn-connected-bg-color': '#D548EC',
        }}
      >
        <App />
      </PushUniversalWalletProvider>
    </ThemeProvider>
  </StrictMode>,
)
