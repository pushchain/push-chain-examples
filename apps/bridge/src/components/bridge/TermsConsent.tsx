import { Box, styled, Text } from "shared-components";
import { BRIDGE_SIGNAL_EVENTS, trackEvent } from "../../services/analytics";

const TermsConsent = () => {
    return (
        <Box textAlign='center'>
            <Text
                variant="bs-regular" 
                color="text-secondary"
            >
                By using Push Bridge, you agree to our {" "}
                <Link
                    href="https://push.org/tos"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                        trackEvent(BRIDGE_SIGNAL_EVENTS.LEGAL_LINK_CLICKED, {
                            link: 'terms_of_service',
                        })
                    }
                >
                    Terms of Service
                </Link>
                {" "}and{" "}
                <Link
                    href="https://push.org/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                        trackEvent(BRIDGE_SIGNAL_EVENTS.LEGAL_LINK_CLICKED, {
                            link: 'privacy_policy',
                        })
                    }
                >
                    Privacy Policy
                </Link>.
            </Text>
        </Box>
    );
}

const Link = styled.a`
  color: var(--text-brand-medium);
`;

export default TermsConsent;