import { Box, styled } from 'shared-components';
import {
  PushUniversalAccountButton,
} from '@pushchain/ui-kit';

const Header = () => {
  return (
    <Box
        display='flex' 
        justifyContent='space-between' 
        alignItems='center'
        padding='spacing-sm'
    >
        <Box display='flex' alignItems='center' gap='spacing-sm'>
            <img height='31px' src="/BridgeLogo.png" alt="Logo" />
            <ResponsiveImg height='38px' src="/PushTitle.png" alt="Title" />
        </Box>
        <PushUniversalAccountButton />
    </Box>
  );
};

export default Header;

const ResponsiveImg = styled.img`
  @media (max-width: 768px) {
    display: none;
  }
`