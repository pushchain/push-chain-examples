import { Box, css } from 'shared-components';
import { BRIDGE_SIGNAL_EVENTS, trackEvent } from '../services/analytics';

const Footer = () => {
  return (
    <Box
        display='flex' 
        justifyContent='space-between' 
        alignItems='center'
        padding='spacing-sm'
        position='fixed'
        width='100%'
        css={css`
            bottom: 0;
            box-sizing: border-box;

            @media (max-width: 768px) {
                position: unset;
            }
        `}
    >
        <Box display='flex' alignItems='center' gap='spacing-sm'>
            <a
                href="https://discord.com/invite/pushchain"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join us on Discord"
                style={{height: '16px', paddingRight: '16px'}}
                onClick={() =>
                    trackEvent(BRIDGE_SIGNAL_EVENTS.SOCIAL_LINK_CLICKED, {
                        network: 'discord',
                    })
                }
            >
                <img height={16} src="/Discord.png" alt="Discord" />
            </a>
            <a
                href="https://x.com/PushChain"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Twitter"
                style={{height: '16px', paddingRight: '16px'}}
                onClick={() =>
                    trackEvent(BRIDGE_SIGNAL_EVENTS.SOCIAL_LINK_CLICKED, {
                        network: 'x',
                    })
                }
            >
                <img height={16} src="/Twitter.png" alt="Twitter" />
            </a>
            {/* <a
                href="https://push.org/privacy"
            >
                <Text variant='bs-regular' color='text-secondary'>Privacy Policy</Text>
            </a>
            <a
                href="https://push.org/tos"
            >
                <Text variant='bs-regular' color='text-secondary'>Terms of Service</Text>
            </a> */}
        </Box>
        <img height='24px' src="/PushFooter.png" alt="Footer" />
    </Box>
  );
};

export default Footer;