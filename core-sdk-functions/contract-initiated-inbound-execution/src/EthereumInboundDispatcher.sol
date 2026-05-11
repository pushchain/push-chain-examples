// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// EthereumInboundDispatcher
// =========================
// A minimal Sepolia (or any EVM external chain) contract that triggers an
// action on Push Chain. The contract calls the per-chain UniversalGateway
// directly. Push Chain's TSS validators pick up the gateway event and
// deliver the call from the contract's UEA on Push Chain — so on Push Chain
// the target sees `msg.sender == this contract's UEA`.
//
// Routing pattern:
//   [Sepolia EOA] → [this contract] → [Sepolia UniversalGateway] ──TSS──▶
//                                       [contract's UEA on Push] → [target]
//
// Wire format (must match what the SDK builds — gateway/TSS won't relay
// otherwise):
//   gateway request: { recipient: 0, token: 0, amount: 0, payload: enc, revertRecipient, signatureData: 0x }
//   enc = abi.encode(UniversalPayload{
//       to: 0,
//       value: 0,
//       data: 0x2cc2842d || abi.encode(Multicall[]),
//       gasLimit, maxFeePerGas, maxPriorityFeePerGas,
//       nonce: <UEA's nonce on Push>,
//       deadline,
//       vType: 0  // universalTxVerification
//   })
//
// `recipient` on the gateway request is ALWAYS zero. The real Push-side
// target lives inside the multicall data within the encoded payload.

/// @notice Per-call entry inside the UEA_MULTICALL payload format.
struct Multicall {
    address to;
    uint256 value;
    bytes data;
}

/// @notice The struct the UEA on Push will execute. Exactly the same fields
/// the SDK builds in `encodeUniversalPayload`.
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

/// @notice V1 UniversalGateway request shape used by every external EVM chain.
struct UniversalTxRequest {
    address recipient;
    address token;
    uint256 amount;
    bytes payload;
    address revertRecipient;
    bytes signatureData;
}

/// @notice Minimal external-chain UniversalGateway interface.
interface IUniversalGateway {
    function sendUniversalTx(UniversalTxRequest calldata req) external payable;
}

contract EthereumInboundDispatcher {
    // -------------------------------------------------------------------------
    // Constants / Config
    // -------------------------------------------------------------------------

    /// @notice The per-chain UniversalGateway. Set via constructor.
    /// Sepolia: 0x05bD7a3D18324c1F7e216f7fBF2b15985aE5281A
    /// BNB Testnet: 0x44aFFC61983F4348DdddB886349eb992C061EaC0
    address public immutable gateway;

    /// @notice 4-byte marker the destination UEA looks for to decode multicall.
    /// = bytes4(keccak256("UEA_MULTICALL"))
    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event InboundDispatched(
        address indexed pushTarget,
        bytes pushCalldata,
        uint256 nonce,
        uint256 fee
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _gateway) {
        if (_gateway == address(0)) revert ZeroAddress();
        gateway = _gateway;
    }

    // -------------------------------------------------------------------------
    // Inbound dispatch — external chain → Push Chain
    // -------------------------------------------------------------------------

    /// @notice Trigger an action on Push Chain. The contract's UEA on Push
    /// (deterministically derived from this contract's address) becomes the
    /// `msg.sender` that calls `pushTarget` with `pushCalldata`.
    /// @param pushTarget Final destination contract on Push Chain.
    /// @param pushCalldata ABI-encoded calldata for `pushTarget`.
    /// @param nonce UEA nonce on Push for this dispatch (0 for the first call,
    ///     incremented per delivered tx). Tracks replay protection on the UEA.
    /// @param revertRecipient Address (on the *external* chain) to receive a
    ///     refund if the Push side reverts. Pass `msg.sender` for normal use.
    function triggerOnPush(
        address pushTarget,
        bytes calldata pushCalldata,
        uint256 nonce,
        address revertRecipient
    ) external payable {
        if (pushTarget == address(0) || revertRecipient == address(0)) {
            revert ZeroAddress();
        }

        // 1) Wrap the (target, calldata) pair into the UEA's multicall format.
        Multicall[] memory calls = new Multicall[](1);
        calls[0] = Multicall({to: pushTarget, value: 0, data: pushCalldata});
        bytes memory multicallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(calls)
        );

        // 2) Wrap the multicall in the UniversalPayload struct the UEA expects.
        //    Because `data` is multicall-wrapped (starts with UEA_MULTICALL_SELECTOR
        //    = 0x2cc2842d), the UEA branches into _handleMulticall and IGNORES
        //    `to`. Conventionally set to address(0). If you instead pass raw
        //    single-call calldata (no selector prefix), UEA_EVM.sol executes
        //    `to.call{value}(data)` and `to` MUST be the real target.
        //    Verified in push-chain-core-contracts/src/UEA/UEA_EVM.sol#executeUniversalTx.
        bytes memory universalPayload = abi.encode(
            address(0),         // to: ignored when data is multicall-wrapped (this example)
            uint256(0),         // value
            multicallData,      // data (multicall-wrapped)
            uint256(1e7),       // gasLimit (matches SDK default)
            uint256(1e10),      // maxFeePerGas (10 gwei, matches SDK)
            uint256(0),         // maxPriorityFeePerGas
            nonce,              // nonce
            uint256(9999999999),// deadline
            uint8(0)            // vType = universalTxVerification
        );

        // 3) Build the gateway request and dispatch.
        UniversalTxRequest memory req = UniversalTxRequest({
            recipient: address(0),     // always zero — real target is in payload
            token: address(0),
            amount: 0,
            payload: universalPayload,
            revertRecipient: revertRecipient,
            signatureData: ""
        });

        IUniversalGateway(gateway).sendUniversalTx{value: msg.value}(req);

        emit InboundDispatched(pushTarget, pushCalldata, nonce, msg.value);
    }

    /// @notice Allow the contract to receive ETH (e.g. for gateway fee refunds).
    receive() external payable {}
}
