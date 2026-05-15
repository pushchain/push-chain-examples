// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// MinimalContractInitiatedExecutor
// =================================
// The smallest contract that demonstrates **contract-initiated outbound** —
// a Push Chain contract autonomously dispatches a cross-chain call through
// UGPC (UniversalGatewayPC). The contract's CEA on the destination chain
// executes the payload.
//
// This is a **one-way example**: Push → external. There's no inbound back-leg
// here — for that pattern (Push contract receives a TSS callback when the
// destination tx finishes), see [`../contract-initiated-roundtrip-execution/`].

/// @notice Outbound request shape consumed by UGPC (SDK v6 layout).
struct UniversalOutboundTxRequest {
    bytes   recipient;       // raw destination address on source chain (bytes for SVM compat). bytes("") parks funds in caller's CEA
    address token;           // PRC20 token address on Push Chain (address(0) for none)
    uint256 amount;          // amount to withdraw (burn on Push, unlock at origin)
    uint256 gasLimit;        // gas limit for fee quote (0 = per-chain default)
    uint256 gasPrice;        // gas price override (0 = per-chain default from UniversalCore; new in v6)
    uint256 maxPCForGas;     // max native PC for the gas swap (0 = no cap; new in v6)
    bytes   payload;         // ABI-encoded calldata to execute on origin chain (empty for funds-only)
    address revertRecipient; // address to receive funds in case of revert
}

/// @notice Minimal UGPC interface.
interface IUniversalGatewayPC {
    function sendUniversalTxOutbound(UniversalOutboundTxRequest calldata req) external payable;
}

/// @notice Minimal PRC20 interface for approvals.
interface IPRC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract MinimalContractInitiatedExecutor {
    // -------------------------------------------------------------------------
    // Constants / Config
    // -------------------------------------------------------------------------

    /// @notice UGPC (UniversalGatewayPC) on Push Chain. Set via constructor.
    /// Donut Testnet: 0x00000000000000000000000000000000000000C1
    address public immutable ugpc;

    // -------------------------------------------------------------------------
    // Events / Errors
    // -------------------------------------------------------------------------

    event OutboundDispatched(
        bytes indexed recipient,
        address indexed token,
        uint256 amount,
        bytes payload,
        address revertRecipient
    );

    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _ugpc) {
        if (_ugpc == address(0)) revert ZeroAddress();
        ugpc = _ugpc;
    }

    // -------------------------------------------------------------------------
    // Outbound: Push Chain → External Chain
    // -------------------------------------------------------------------------

    /// @notice Dispatch an outbound cross-chain execution from this contract.
    /// @dev `msg.value` must cover the UGPC protocol fee. If bridging PRC20
    /// tokens, this function approves UGPC for the amount before calling.
    /// @param token PRC20 token on Push Chain. Use address(0) if not bridging tokens.
    /// @param amount Amount of PRC20 to bridge. Use 0 if not bridging.
    /// @param recipient Bytes-encoded CEA or destination address on the external chain.
    /// @param gasLimit Gas limit for the external-chain execution. Use 0 for default.
    /// @param payload ABI-encoded calldata or app payload for the external-chain action.
    /// @param revertRecipient Address to receive bridged funds if the external tx reverts.
    function dispatchOutbound(
        address token,
        uint256 amount,
        bytes calldata recipient,
        uint256 gasLimit,
        bytes calldata payload,
        address revertRecipient
    ) external payable {
        if (revertRecipient == address(0)) revert ZeroAddress();

        if (amount > 0) {
            if (token == address(0)) revert ZeroAddress();
            IPRC20(token).approve(ugpc, amount);
        }

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: msg.value}(
            UniversalOutboundTxRequest({
                recipient: recipient,
                token: token,
                amount: amount,
                gasLimit: gasLimit,
                gasPrice: 0,            // per-chain default from UniversalCore
                maxPCForGas: 0,         // no cap on PC for the gas swap
                payload: payload,
                revertRecipient: revertRecipient
            })
        );

        emit OutboundDispatched(recipient, token, amount, payload, revertRecipient);
    }

    // Allow the contract to receive PC (e.g. UGPC fee refunds).
    receive() external payable {}
}
