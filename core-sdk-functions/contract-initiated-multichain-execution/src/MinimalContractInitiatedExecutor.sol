// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// MinimalContractInitiatedExecutor
// =================================
// The smallest contract that exercises both directions of contract-initiated
// multichain execution on Push Chain:
//
//   • Outbound: Push Chain contract → external chain
//     Calls UGPC (UniversalGatewayPC) to dispatch a payload that the contract's
//     CEA executes on the target chain.
//
//   • Inbound: external chain → Push Chain contract
//     Receives an `executeUniversalTx()` call from UNIVERSAL_EXECUTOR_MODULE
//     when an external CEA has executed and a response needs to come back.

/// @notice Outbound request shape consumed by UGPC.
struct UniversalOutboundTxRequest {
    bytes recipient;        // CEA or target address on the external chain (bytes-encoded)
    address token;          // PRC20 on Push Chain to bridge (address(0) for none)
    uint256 amount;         // Amount of PRC20 to bridge
    uint256 gasLimit;       // Gas limit for external execution (0 = default)
    bytes payload;          // ABI-encoded calldata for the CEA to execute on the target chain
    address revertRecipient;// Address to receive bridged funds if external tx reverts
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

    /// @notice The trusted module that delivers inbound payloads. Set via constructor.
    /// Donut Testnet: 0x14191Ea54B4c176fCf86f51b0FAc7CB1E71Df7d7
    address public immutable universalExecutorModule;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Replay protection — every inbound `txId` is single-use.
    mapping(bytes32 => bool) public executedTxIds;

    /// @notice Example app state: how much each beneficiary has been credited
    /// across inbound calls. Updated by the example payload action `0`.
    mapping(address => uint256) public creditedAmount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event OutboundDispatched(
        bytes indexed recipient,
        address indexed token,
        uint256 amount,
        bytes payload,
        address revertRecipient
    );

    event InboundExecuted(
        bytes32 indexed txId,
        string sourceChainNamespace,
        bytes ceaAddress,
        address prc20,
        uint256 amount
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotUniversalExecutor();
    error TxAlreadyExecuted();
    error ZeroAddress();
    error UnsupportedAction();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _ugpc, address _universalExecutorModule) {
        if (_ugpc == address(0) || _universalExecutorModule == address(0)) {
            revert ZeroAddress();
        }
        ugpc = _ugpc;
        universalExecutorModule = _universalExecutorModule;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Always validate inbound payloads come from the trusted executor.
    modifier onlyUniversalExecutor() {
        if (msg.sender != universalExecutorModule) revert NotUniversalExecutor();
        _;
    }

    // -------------------------------------------------------------------------
    // Outbound: Push Chain → External Chain
    // -------------------------------------------------------------------------

    /// @notice Dispatch an outbound cross-chain execution from this contract.
    /// @dev `msg.value` must cover the UGPC protocol fee. If bridging PRC20
    /// tokens, this function approves UGPC for the amount before calling.
    /// @param token PRC20 token on Push Chain. Use address(0) if not bridging tokens.
    /// @param amount Amount of PRC20 to bridge. Use 0 if not bridging.
    /// @param recipient Bytes-encoded CEA or target address on the external chain.
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
                payload: payload,
                revertRecipient: revertRecipient
            })
        );

        emit OutboundDispatched(recipient, token, amount, payload, revertRecipient);
    }

    // -------------------------------------------------------------------------
    // Inbound: External Chain → Push Chain
    // -------------------------------------------------------------------------

    /// @notice Receives an inbound cross-chain payload.
    /// @dev Only UNIVERSAL_EXECUTOR_MODULE may call this. Replay protected via txId.
    ///
    /// This example assumes payload is encoded as:
    ///     abi.encode(uint8 action, address beneficiary)
    ///
    /// Example actions:
    ///     0 = CREDIT beneficiary with the bridged `amount`.
    function executeUniversalTx(
        string calldata sourceChainNamespace,
        bytes calldata ceaAddress,
        bytes calldata payload,
        uint256 amount,
        address prc20,
        bytes32 txId
    ) external payable onlyUniversalExecutor {
        if (executedTxIds[txId]) revert TxAlreadyExecuted();
        executedTxIds[txId] = true;

        (uint8 action, address beneficiary) = abi.decode(payload, (uint8, address));

        if (action == 0) {
            creditedAmount[beneficiary] += amount;
        } else {
            revert UnsupportedAction();
        }

        emit InboundExecuted(txId, sourceChainNamespace, ceaAddress, prc20, amount);
    }

    // Allow the contract to receive PC for protocol fees.
    receive() external payable {}
}
