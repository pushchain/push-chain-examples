import React from 'react';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { getBlocksCSSVariables, themeConfig } from 'shared-components';
import {
  AppMetadata,
  PushUI,
  PushUniversalWalletProvider,
  ProviderConfigProps,
} from '@pushchain/ui-kit';
import Migrate from './Migrate';
import './index.css';

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

const App: React.FC = () => {

  const walletConfig: ProviderConfigProps = {
    uid: 'wallet1',
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    login: {
      wallet: {
        enabled: false,
      },
      appPreview: true,
    },
    version: 4,
  };

  const walletConfig2: ProviderConfigProps = {
    uid: 'wallet2',
    network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET,
    login: {
      wallet: {
        enabled: false,
      },
      appPreview: true,
    },
  };

  const appMetadata: AppMetadata = {
    logoUrl: 'https://avatars.githubusercontent.com/u/64157541?v=4',
    title: 'Simulate',
    description:
      'Push Chain is a shared state L1 blockchain that allows all chains to unify, enabling apps of any chain to be accessed by users of any chain.',
  };

  return (
    <ThemeProvider theme={themeConfig.dark}>
      <GlobalStyle />
      <PushUniversalWalletProvider
        config={walletConfig}
        app={appMetadata}
        themeMode={PushUI.CONSTANTS.THEME.LIGHT}
        themeOverrides={{
          '--pw-core-font-family': 'FK Grotesk Neu',
        }}
      >
        <PushUniversalWalletProvider
          config={walletConfig2}
          app={appMetadata}
          themeMode={PushUI.CONSTANTS.THEME.LIGHT}
          themeOverrides={{
            '--pw-core-font-family': 'FK Grotesk Neu',
          }}
        >
          <Migrate />
        </PushUniversalWalletProvider>
      </PushUniversalWalletProvider>
    </ThemeProvider>
  );
};

export default App;
