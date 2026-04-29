import React from 'react';
import { Box } from 'shared-components';
import Header from './components/Header';
import Footer from './components/Footer';
import Bridge from './components/bridge';

const App: React.FC = () => {

  return (
    <Box>
      <Header />
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        padding={{ initial: 'spacing-xxxl', tb: 'spacing-xl spacing-sm' }}
        width={{ initial: 'auto', tb: 'calc(100% - 2 * var(--spacing-sm))' }}
      >
        <Bridge />
      </Box>
      <Footer />
    </Box>
  );
};

export default App;
