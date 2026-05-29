import { Box, css, Spinner, Text, TextInput } from 'shared-components';

type AddressFieldProps = {
    address: string;
    addressError: string;
    loading: boolean;
    prefillNote: string;
    showUseMyAddress: boolean;
    onAddressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUseMyAddress: () => void;
};

const AddressField: React.FC<AddressFieldProps> = ({
    address,
    addressError,
    loading,
    prefillNote,
    showUseMyAddress,
    onAddressChange,
    onUseMyAddress,
}) => {
    const helperText = addressError || prefillNote;

    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="spacing-xxxs"
            margin="spacing-none spacing-none spacing-xs spacing-none"
        >
            {showUseMyAddress ? (
                <Box
                    display="flex"
                    gap="spacing-xxs"
                    alignItems="center"
                    flexDirection={{ initial: 'row', tb: 'column' }}
                >
                    <Box
                        width="64px"
                        display={{ initial: 'block', tb: 'none' }}
                    />
                    <Box
                        width={{
                            initial: 'calc(100% - 72px)',
                            tb: '100%',
                        }}
                        display="flex"
                        justifyContent="flex-end"
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            height="24px"
                            padding="spacing-none spacing-xs"
                            cursor="pointer"
                            onClick={onUseMyAddress}
                        >
                            <Text
                                variant="ol-regular"
                                color="text-secondary"
                                css={css`
                                    &:hover {
                                        color: var(--text-brand-medium);
                                    }
                                `}
                            >
                                Use my address
                            </Text>
                        </Box>
                    </Box>
                </Box>
            ) : null}

            <Box
                display="flex"
                gap="spacing-xxs"
                alignItems={{ initial: 'center', tb: 'flex-start' }}
                flexDirection={{ initial: 'row', tb: 'column' }}
            >
                <Box
                    width="64px"
                    display="flex"
                    justifyContent={{
                        initial: 'center',
                        tb: 'flex-start',
                    }}
                >
                    <Text variant="bm-regular" color="text-secondary">
                        Address
                    </Text>
                </Box>
                <Box
                    width={{
                        initial: 'calc(100% - 72px)',
                        tb: '100%',
                    }}
                >
                    <TextInput
                        onChange={onAddressChange}
                        placeholder="Enter Address"
                        value={address}
                        trailingIcon={
                            loading ? (
                                <Box display="flex" alignItems="center">
                                    <Spinner size="small" variant="secondary" />
                                </Box>
                            ) : undefined
                        }
                    />
                </Box>
            </Box>

            {helperText ? (
                <Box
                    display="flex"
                    gap="spacing-xxs"
                    flexDirection={{ initial: 'row', tb: 'column' }}
                >
                    <Box
                        width="64px"
                        display={{ initial: 'block', tb: 'none' }}
                    />
                    <Box
                        width={{
                            initial: 'calc(100% - 72px)',
                            tb: '100%',
                        }}
                    >
                        <Text
                            variant="bes-regular"
                            color={
                                addressError
                                    ? 'text-state-danger-subtle'
                                    : 'text-tertiary'
                            }
                        >
                            {helperText}
                        </Text>
                    </Box>
                </Box>
            ) : null}
        </Box>
    );
};

export default AddressField;
