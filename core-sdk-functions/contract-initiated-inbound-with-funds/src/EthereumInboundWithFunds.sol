// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// EthereumInboundWithFunds
// ========================
// A Sepolia (or any V1 gateway EVM chain) contract that bridges native ETH
// to Push Chain AND triggers a contract call against a target on Push, in
// the SAME universal transaction. Combines the patterns from:
//   - `contract-initiated-recipient-bridge/`  (funds-only bridge)
//   - `contract-initiated-inbound-execution/` (calldata-only inbound)
//
// Routing pattern:
//   [Sepolia EOA] ──bridgeAndCall(target, calldata, amount)──▶
//        EthereumInboundWithFunds ──gateway.sendUniversalTx{value: amount + fee}──▶
//          Sepolia UniversalGateway ──TSS──▶ Push UEA(this contract)
//                                                │ (UEA receives `amount` PC)
//                                                │ then executes multicall:
//                                                ▼
//                                         pushTarget.<calldata>{value: amount}
//                                         msg.sender == this contract's UEA
//
// On Push, the call to `pushTarget` carries `amount` wei of PC as msg.value.
// `pushTarget` must be `payable` if called with non-zero value.

/// @notice Inner multicall struct.
struct Multicall {
    address to;
    uint256 value;
    bytes data;
}

/// @notice Standard UniversalPayload struct.
struct UniversalPayload {
    address to;
    uint256 value;
    bytes data;
    uint256 gasLimit;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    uint256 nonce;
    uint256 deadline;
    uint8 vType;
}

/// @notice V1 UniversalGateway request.
struct UniversalTxRequest {
    address recipient;
    address token;
    uint256 amount;
    bytes payload;
    address revertRecipient;
    bytes signatureData;
}

interface IUniversalGateway {
    function sendUniversalTx(UniversalTxRequest calldata req) external payable;
}

contract EthereumInboundWithFunds {
    address public immutable gateway;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    event InboundWithFundsDispatched(
        address indexed pushTarget,
        bytes pushCalldata,
        uint256 bridgeAmount,
        uint256 fee,
        uint256 nonce
    );

    error ZeroAddress();
    error InsufficientValue();

    constructor(address _gateway) {
        if (_gateway == address(0)) revert ZeroAddress();
        gateway = _gateway;
    }

    /// @notice Bridge native ETH AND trigger a contract call on Push Chain.
    /// @dev `msg.value` MUST equal `bridgeAmount + fee`. The bridged amount
    ///     becomes msg.value of the inner call to `pushTarget`. The fee
    ///     (~0.0005 ETH on Sepolia) covers the gateway protocol fee.
    /// @param pushTarget Push Chain contract whose function will be invoked.
    /// @param pushCalldata ABI-encoded calldata for `pushTarget` (e.g.
    ///     `abi.encodeWithSignature("deposit(address)", recipient)`).
    /// @param bridgeAmount Wei of ETH to bridge. The Push UEA will use this
    ///     as `msg.value` when calling `pushTarget`.
    /// @param nonce UEA nonce on Push for replay protection. Read via
    ///     `UEA.nonce()`; for a fresh UEA pass 0.
    function bridgeAndCall(
        address pushTarget,
        bytes calldata pushCalldata,
        uint256 bridgeAmount,
        uint256 nonce
    ) external payable {
        if (pushTarget == address(0)) revert ZeroAddress();
        if (msg.value <= bridgeAmount) revert InsufficientValue();

        // Inner multicall: a single call to `pushTarget` with the bridged
        // amount as msg.value. The Push UEA executes this after the gateway
        // credits it with the bridged ETH.
        Multicall[] memory calls = new Multicall[](1);
        calls[0] = Multicall({to: pushTarget, value: bridgeAmount, data: pushCalldata});
        bytes memory multicallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(calls)
        );

        // Wrap in the UniversalPayload struct.
        bytes memory universalPayload = abi.encode(
            address(0),
            uint256(0),
            multicallData,
            uint256(1e7),
            uint256(1e10),
            uint256(0),
            nonce,
            uint256(9999999999),
            uint8(0)
        );

        // Build the gateway request — token=0 (native), amount=bridgeAmount.
        UniversalTxRequest memory req = UniversalTxRequest({
            recipient: address(0),
            token: address(0),       // 0 = native ETH
            amount: bridgeAmount,
            payload: universalPayload,
            revertRecipient: msg.sender,
            signatureData: ""
        });

        IUniversalGateway(gateway).sendUniversalTx{value: msg.value}(req);

        emit InboundWithFundsDispatched(
            pushTarget,
            pushCalldata,
            bridgeAmount,
            msg.value - bridgeAmount,
            nonce
        );
    }

    receive() external payable {}
}
