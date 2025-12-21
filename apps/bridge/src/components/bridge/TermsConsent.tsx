import { Box, styled, Text } from "shared-components";

const TermsConsent = () => {
    return (
        <Box textAlign='center'>
            <Text
                variant="bs-regular" 
                color="text-secondary"
            >
                By using Push Bridge, you agree to our {" "}
                <Link href="https://push.org/tos" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                </Link>
                {" "}and{" "}
                <Link href="https://push.org/privacy" target="_blank" rel="noopener noreferrer">
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