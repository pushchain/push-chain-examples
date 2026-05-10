// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// EthereumFundsBridge
// ===================
// A minimal Sepolia (or any V1 gateway EVM chain) contract that bridges native
// ETH to a recipient address on Push Chain — no payload to execute, just funds.
//
// Routing pattern:
//   [Sepolia EOA] ──bridgeToPush(recipient, amount)──▶
//        EthereumFundsBridge ──gateway.sendUniversalTx──▶ TSS validators
//                                                            │
//                                                            ▼
//                                                Contract's UEA on Push
//                                                  forwards `amount`
//                                                  to `recipient`
//
// The bridge contract itself doesn't authenticate — anyone can call it. But
// the resulting credit lands in the *contract's* UEA on Push, then the UEA
// performs a native transfer to `recipient` (encoded inside the multicall).

/// @notice Inner multicall struct the destination UEA executes.
struct Multicall {
    address to;
    uint256 value;
    bytes data;
}

/// @notice The struct the UEA on Push will execute.
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

/// @notice V1 UniversalGateway request shape.
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

contract EthereumFundsBridge {
    /// @notice The per-chain UniversalGateway. Sepolia: 0x05bD7a3D...281A
    address public immutable gateway;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    event Bridged(address indexed pushRecipient, uint256 bridgeAmount, uint256 fee);

    error ZeroAddress();
    error InsufficientValue();

    constructor(address _gateway) {
        if (_gateway == address(0)) revert ZeroAddress();
        gateway = _gateway;
    }

    /// @notice Bridge native ETH to `pushRecipient` on Push Chain.
    /// @dev `msg.value` must equal `bridgeAmount + fee`. The fee is whatever
    ///     the gateway requires (~0.000432 ETH on Sepolia for the minimum
    ///     1 USD deposit). The contract just forwards everything to the
    ///     gateway in one call.
    /// @param pushRecipient EVM address on Push Chain that will receive the
    ///     bridged funds (delivered as native PC by the destination UEA).
    /// @param bridgeAmount Wei of native ETH to bridge — included in
    ///     `msg.value` along with the fee.
    /// @param nonce Push UEA nonce (0 for the first bridge from this contract;
    ///     read on-chain via `UEA.nonce()` for subsequent calls).
    function bridgeToPush(
        address pushRecipient,
        uint256 bridgeAmount,
        uint256 nonce
    ) external payable {
        if (pushRecipient == address(0)) revert ZeroAddress();
        if (msg.value <= bridgeAmount) revert InsufficientValue();

        // 1) Inner multicall: a single native transfer to `pushRecipient` for
        //    `bridgeAmount` wei. This is what the UEA on Push executes after
        //    the gateway credits it with the bridged amount.
        Multicall[] memory calls = new Multicall[](1);
        calls[0] = Multicall({to: pushRecipient, value: bridgeAmount, data: ""});
        bytes memory multicallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(calls)
        );

        // 2) Wrap in the UniversalPayload struct.
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

        // 3) Build the gateway request and dispatch.
        UniversalTxRequest memory req = UniversalTxRequest({
            recipient: address(0),
            token: address(0),       // 0 = native ETH
            amount: bridgeAmount,    // gateway treats this as the bridge amount
            payload: universalPayload,
            revertRecipient: msg.sender,
            signatureData: ""
        });

        IUniversalGateway(gateway).sendUniversalTx{value: msg.value}(req);

        emit Bridged(pushRecipient, bridgeAmount, msg.value - bridgeAmount);
    }

    receive() external payable {}
}
