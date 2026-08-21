import { useState } from "react";
import { Box, CaretDown, Cross, css, Text } from "shared-components";

export type SelectOption = {
    icon?: any;
    label: string;
    value: string;
    displayName?: string;
    badge?: any;
}

type SelectProps = {
    selected: SelectOption | null;
    options: SelectOption[];
    onChange?: (opt: SelectOption) => void;
    title?: React.ReactNode;
    placeholder?: string;
    disabled?: boolean;
};

const Select: React.FC<SelectProps> = ({
    selected,
    options,
    onChange,
    title,
    placeholder,
    disabled,
}) => {
    const [open, setOpen] = useState(false);

    const SelectedIcon = selected?.icon;

    return (
        <>
            <Box
                display='flex'
                borderRadius='radius-xs'
                border='border-xmd solid stroke-secondary'
                backgroundColor='surface-secondary'
                padding='spacing-xs'
                height='51px'
                cursor={disabled ? 'not-allowed' : 'pointer'}
                onClick={() => !disabled && setOpen(true)}
                data-disabled={disabled || undefined}
                css={css`
                    flex: 1;
                    box-sizing: border-box;
                    &:not([data-disabled]):hover {
                        border: 1.5px solid var(--stroke-tertiary);
                    };
                    &:not([data-disabled]):focus-within {
                        border: 1.5px solid var(--stroke-brand-bold);
                    };
                    &[data-disabled] {
                        opacity: 0.5;
                    }
                `}
            >
                <Box
                    display='flex'
                    justifyContent='space-between'
                    alignItems='center'
                    width='100%'
                    css={css`
                        text-overflow: ellipsis;
                        overflow: hidden;
                        white-space: nowrap;
                    `}
                >
                    {
                        selected ? (
                            <Box display='flex' gap='spacing-xs' alignItems='center'>
                                {SelectedIcon && <SelectedIcon size={24} />}
                                <Text variant='bm-regular' color='text-secondary'>
                                    {selected.label.includes('ETH') ? 'ETH' : selected.label}
                                </Text>
                            </Box>
                        ) : (
                            <Text
                                variant='bm-regular'
                                color='text-tertiary'
                            >
                                {placeholder || 'Select an option'}
                            </Text>
                        )
                    }
                    <CaretDown size={20} color="icon-primary" />
                </Box>
            </Box>

            {
                open && (
                    <Box
                        position='fixed'
                        display='flex'
                        justifyContent='center'
                        alignItems='center'
                        height='100dvh'
                        padding={{ initial: 'spacing-sm', tb: 'spacing-sm' }}
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget) setOpen(false);
                        }}
                        onTouchStart={(e) => {
                            if (e.target === e.currentTarget) setOpen(false);
                        }}
                        css={css`
                            z-index: 99999;
                            inset: 0;
                            opacity: ${open ? 1 : 0};
                            background: rgba(0, 0, 0, 0.6);
                        `}
                    >
                        <Box
                            display='flex'
                            flexDirection='column'
                            borderRadius='radius-md'
                            border='border-sm solid stroke-secondary'
                            backgroundColor='surface-secondary'
                            minWidth={{ initial: '400px', tb: '100%' }}
                            maxHeight='70dvh'
                            customScrollbar
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            css={css`
                                overflow-x: hidden;
                                overflow-y: auto;
                            `}
                        >
                            <Box display='flex' alignItems='center' justifyContent='space-between' padding='spacing-sm'>
                                <Box>
                                    {title ? title : (
                                        <Text variant='h5-regular' color='text-primary'>Select an option</Text>
                                    )}
                                </Box>
                                <Box
                                    cursor='pointer'
                                    onClick={() => setOpen(false)}
                                >
                                    <Cross width={11} height={11} color='icon-tertiary' />
                                </Box>
                            </Box>
                            <Box height="1px" backgroundColor='surface-tertiary' />
                            {
                                options.map((opt) => {
                                    const ChainIcon = opt?.icon;
                                    const BadgeIcon = opt?.badge;
                                    return (
                                        <Box
                                            key={opt.value}
                                            display='flex'
                                            alignItems='center'
                                            padding='spacing-sm'
                                            cursor='pointer'
                                            onClick={() => {
                                                onChange?.(opt);
                                                setOpen(false);
                                            }}
                                            css={css`
                                                :hover {
                                                    background-color: var(--surface-secondary);
                                                }
                                            `}
                                        >
                                            <Box display='flex' gap='spacing-xs' alignItems='center'>
                                                <Box position="relative">
                                                    {ChainIcon && <ChainIcon />}
                                                    {BadgeIcon && (
                                                        <Box
                                                            position="absolute"
                                                            borderRadius="radius-round"
                                                            css={css`
                                                                bottom: -4px;
                                                                right: -2px;
                                                            `}
                                                        >
                                                            <BadgeIcon width={12} height={12} />
                                                        </Box>
                                                    )}
                                                </Box>
                                                <Text variant='bm-regular' color='text-secondary'>
                                                    {opt.displayName || opt.label}
                                                </Text>
                                            </Box>
                                        </Box>
                                    );
                                })
                            }
                        </Box>
                    </Box>
                )
            }
        </>
    );
};

export default Select;
