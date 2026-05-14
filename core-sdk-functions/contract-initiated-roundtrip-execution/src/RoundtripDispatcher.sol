// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// RoundtripDispatcher
// ===================
// A Push Chain contract that dispatches an outbound to BNB Testnet AND
// receives an automatic completion callback when the back-leg lands.
//
// **What makes the back-leg fire** (verified by elimination across earlier
// failed runs):
//   1. `gasLimit ≥ 2_000_000` on the UGPC outbound. The 500k auto-floor is
//      too tight; TSS silently drops the back-leg if the destination tx
//      would run out of gas.
//   2. Contract pre-funded with PC (the docs require it for inbound
//      execution fees).
//   3. Outbound payload uses the SDK Route 3 wire format — the destination
//      CEA's outer multicall must include a self-call to
//      `CEA.sendUniversalTxToUEA(token, amount, encodedUniversalPayload, revertRecipient)`.
//      Plain multicalls without that self-call do NOT trigger the back-leg.
//
//   [Push EOA] ──kickOff()──▶ this contract ──UGPC──▶ [BNB CEA]
//                                  ▲                       │
//                                  │                       │ outer multicall step:
//                                  │                       ▼
//                            executeUniversalTx     CEA.sendUniversalTxToUEA(self-call)
//                            (6-arg, docs-style)           │
//                                                          ▼
//                                                  gateway.sendUniversalTxFromCEA
//                                                          │
//                                                          ▼
//                          TSS Cosmos universal-executor ──▶ this contract
//                          (msg.sender == UNIVERSAL_EXECUTOR_MODULE)
//
// For Push-native contracts, TSS dispatches the docs-style 6-arg
// `executeUniversalTx(string, bytes, bytes, uint256, address, bytes32)`.
// The 2-arg `executeUniversalTx(UniversalPayload, bytes)` overload exists
// in the codebase for actual UEA proxy accounts and is not invoked for
// ordinary Push contracts; this contract implements only the 6-arg path.

/// @notice UGPC outbound request — `target` is the destination CEA bytes.
struct UniversalOutboundTxRequest {
    bytes recipient;
    address token;
    uint256 amount;
    uint256 gasLimit;
    uint256 gasPrice;
    uint256 maxPCForGas;
    bytes payload;
    address revertRecipient;
}

interface IUniversalGatewayPC {
    function sendUniversalTxOutbound(UniversalOutboundTxRequest calldata req) external payable;
}

contract RoundtripDispatcher {
    // -------------------------------------------------------------------------
    // Constants / Config
    // -------------------------------------------------------------------------

    address public immutable ugpc;
    address public immutable universalExecutorModule;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 public outboundCount;
    uint256 public callbacks;

    mapping(bytes32 => bool) public seenTxIds;
    bytes32 public lastTxId;

    // -------------------------------------------------------------------------
    // Events / Errors
    // -------------------------------------------------------------------------

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event OutboundKicked(uint256 outboundCount, bytes payload);

    event Callback(
        uint256 sequence,
        bytes32 indexed txId,
        string sourceChainNamespace,
        bytes ceaAddress,
        address prc20,
        uint256 amount
    );

    error NotUniversalExecutor();
    error ZeroAddress();
    error TxAlreadyExecuted();
    error InsufficientPC(uint256 required, uint256 available);

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Multicall {
        address to;
        uint256 value;
        bytes data;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _ugpc, address _module) {
        if (_ugpc == address(0) || _module == address(0)) revert ZeroAddress();
        ugpc = _ugpc;
        universalExecutorModule = _module;
    }

    // -------------------------------------------------------------------------
    // Funding
    // -------------------------------------------------------------------------

    function fund() external payable {
        emit Funded(msg.sender, msg.value, address(this).balance);
    }

    // -------------------------------------------------------------------------
    // Outbound — Push → BNB via UGPC, with CEA self-call to sendUniversalTxToUEA
    //   so the back-leg fires automatically.
    // -------------------------------------------------------------------------

    /// @param destinationCEAAddr This contract's CEA on the destination chain
    ///     (= `deriveExecutorAccount(this, BNB_TESTNET)`). Runner derives it.
    /// @param tokenForRouting PRC-20 on Push selecting the destination chain.
    /// @param protocolFeePc PC the contract forwards to UGPC for outbound fee.
    /// @param ueaNonce Current Push-side nonce (0 for fresh; runner reads it).
    function kickOff(
        address destinationCEAAddr,
        address tokenForRouting,
        uint256 protocolFeePc,
        uint256 ueaNonce
    ) external {
        if (destinationCEAAddr == address(0)) revert ZeroAddress();
        if (address(this).balance < protocolFeePc) {
            revert InsufficientPC(protocolFeePc, address(this).balance);
        }

        // ---- Layer 1: a no-op multicall the inbound side will see -----------
        Multicall[] memory innerCalls = new Multicall[](1);
        innerCalls[0] = Multicall({to: address(this), value: 0, data: ""});
        bytes memory innerMulticallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(innerCalls)
        );

        // ---- Layer 2: encoded UniversalPayload struct (vType=1, inbound) ----
        bytes memory inboundUniversalPayload = abi.encode(
            address(0), uint256(0), innerMulticallData,
            uint256(1e7), uint256(1e10), uint256(0),
            ueaNonce + 1, uint256(9999999999), uint8(1)
        );

        // ---- Layer 3: CEA's sendUniversalTxToUEA self-call ------------------
        bytes memory ceaSelfCallData = abi.encodeWithSelector(
            bytes4(keccak256("sendUniversalTxToUEA(address,uint256,bytes,address)")),
            address(0), uint256(0), inboundUniversalPayload, address(this)
        );

        // ---- Layer 4: outer multicall the destination CEA executes ---------
        Multicall[] memory outerCalls = new Multicall[](1);
        outerCalls[0] = Multicall({
            to: destinationCEAAddr,
            value: 0,
            data: ceaSelfCallData
        });
        bytes memory outerMulticallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(outerCalls)
        );

        // ---- Dispatch via UGPC ---------------------------------------------
        bytes memory targetBytes = abi.encodePacked(destinationCEAAddr);
        UniversalOutboundTxRequest memory req = UniversalOutboundTxRequest({
            recipient: targetBytes,
            token: tokenForRouting,
            amount: 0,
            gasLimit: 2_000_000,
            gasPrice: 0,
            maxPCForGas: 0,
            payload: outerMulticallData,
            revertRecipient: address(this)
        });

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: protocolFeePc}(req);

        outboundCount += 1;
        emit OutboundKicked(outboundCount, outerMulticallData);
    }

    // -------------------------------------------------------------------------
    // Inbound — docs-style 6-arg `executeUniversalTx` matches the example in
    //   the public docs at push.org/docs/chain/build/contract-initiated-multichain-execution.
    //   This IS the path TSS calls for Push-native contracts.
    // -------------------------------------------------------------------------

    function executeUniversalTx(
        string calldata sourceChainNamespace,
        bytes calldata ceaAddress,
        bytes calldata /* payload */,
        uint256 amount,
        address prc20,
        bytes32 txId
    ) external payable {
        if (msg.sender != universalExecutorModule) revert NotUniversalExecutor();
        if (seenTxIds[txId]) revert TxAlreadyExecuted();
        seenTxIds[txId] = true;
        callbacks += 1;
        lastTxId = txId;
        emit Callback(
            callbacks, txId, sourceChainNamespace, ceaAddress, prc20, amount
        );
    }

    receive() external payable {}
}
