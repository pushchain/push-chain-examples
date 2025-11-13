import React, { useEffect } from 'react';
import { Box } from 'shared-components';
import Header from './components/Header';
import Footer from './components/Footer';
import Bridge from './components/bridge';
import { usePushChainClient, PushUI, usePushWalletContext } from '@pushchain/ui-kit';

const App: React.FC = () => {
  const { pushChainClient } = usePushChainClient();
  const { handleUserLogOutEvent } = usePushWalletContext();

  useEffect(() => {
    if (pushChainClient && pushChainClient.universal.origin.chain === PushUI.CONSTANTS.CHAIN_CONFIG.PUSH_TESTNET) {
      handleUserLogOutEvent();
    }
  }, [pushChainClient])

  return (
    <Box>
      <Header />
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        padding={{ initial: 'spacing-xxxl', tb: 'spacing-xl spacing-sm' }}
        width='calc(100% - 2 * var(--spacing-sm))'
      >
        <Bridge />
      </Box>
      <Footer />
    </Box>
  );
};

export default App;
