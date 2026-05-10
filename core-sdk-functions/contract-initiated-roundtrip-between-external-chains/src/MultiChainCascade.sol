// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// MultiChainCascade
// =================
// A Push Chain contract that dispatches to TWO external chains from one
// kickOff() call — sequentially, via the back-leg pivot:
//
//   [Push EOA] ──kickOff()──▶ this contract ──UGPC──▶ [BNB CEA]
//                                  ▲                       │
//                                  │                       │ outer multicall:
//                                  │                       ▼
//                              executeUniversalTx    CEA.sendUniversalTxToUEA(self-call)
//                              (TSS auto-callback)         │
//                                  │                       ▼
//                                  │              gateway.sendUniversalTxFromCEA
//                                  │                       │
//                                  │                       ▼
//                                  │                  TSS routes back to Push
//                                  │                       │
//                                  └─── inbound payload arrives here ──┐
//                                                                      │
//                                                                      ▼
//                            Inside executeUniversalTx, this contract dispatches
//                            a NEW UGPC outbound to the Solana CEA → Solana counter
//
// Net effect from one Push tx:
//   1. Push tx hits UGPC → BNB outbound queued
//   2. BNB CEA executes the BNB-side action (counter increment)
//   3. BNB CEA's self-call sends back-leg to Push contract
//   4. TSS calls executeUniversalTx on this contract
//   5. executeUniversalTx fires UGPC again → Solana outbound queued
//   6. Solana CEA executes the Solana-side action (counter increment)
//
// Three chains affected. Funding requirements:
//   - Push contract holds PC for kickOff's outbound fee + executeUniversalTx's outbound fee
//   - BNB CEA holds BNB for the back-leg gateway fee (faucet to its address once)
//   - Solana CEA gets gas budget from UGPC outbound 2 (no separate funding)

struct UniversalOutboundTxRequest {
    bytes target;
    address token;
    uint256 amount;
    uint256 gasLimit;
    bytes payload;
    address revertRecipient;
}

interface IUniversalGatewayPC {
    function sendUniversalTxOutbound(UniversalOutboundTxRequest calldata req) external payable;
}

contract MultiChainCascade {
    address public immutable ugpc;
    address public immutable universalExecutorModule;
    address public immutable owner;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    /// @notice pBNB on Push (selects BNB Testnet for outbound 1).
    address public constant PBNB = 0x7a9082dA308f3fa005beA7dB0d203b3b86664E36;

    /// @notice pSOL on Push (selects Solana Devnet for outbound 2).
    address public constant PSOL = 0x5D525Df2bD99a6e7ec58b76aF2fd95F39874EBed;

    // -------------------------------------------------------------------------
    // Configuration — set once after deploy by owner
    // -------------------------------------------------------------------------

    /// @notice The BNB-side contract to call from the BNB CEA's multicall
    /// (typically a counter contract whose increment() should fire).
    address public bnbDestinationContract;

    /// @notice ABI-encoded calldata for the BNB-side contract (e.g.
    /// `abi.encodeWithSignature("increment()")`).
    bytes public bnbDestinationCalldata;

    /// @notice Bytes-encoded address of THIS contract's CEA on Solana
    /// (the runner derives via `deriveExecutorAccount(this, SOLANA_DEVNET)`).
    /// For Solana, this is a 32-byte program-derived address. Stored as
    /// raw bytes since Solana addresses don't fit in `address`.
    bytes public solanaCEABytes;

    /// @notice Pre-encoded Solana payload bytes — the runner builds this
    /// using the SDK's `encodeTxData({ idl, ... })` helper and stores it
    /// here. The destination Solana CEA executes this payload.
    bytes public solanaPayload;

    // -------------------------------------------------------------------------
    // State — bumped along the cascade for observability
    // -------------------------------------------------------------------------

    uint256 public kickOffCount;       // Push tx → BNB dispatched
    uint256 public bnbBackLegCount;    // back-leg from BNB landed on Push
    uint256 public solanaDispatchCount; // outbound to Solana fired

    mapping(bytes32 => bool) public seenInboundTxIds;
    bytes32 public lastInboundTxId;

    // -------------------------------------------------------------------------
    // Events / Errors
    // -------------------------------------------------------------------------

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event ConfiguredBnbTarget(address indexed bnbContract, bytes calldata_);
    event ConfiguredSolanaTarget(bytes solanaCEABytes, bytes solanaPayload);
    event KickedOff(uint256 kickOffCount, bytes outboundPayload);
    event BnbBackLegLanded(bytes32 indexed txId, uint256 bnbBackLegCount);
    event SolanaDispatched(uint256 solanaDispatchCount, bytes payload);

    error NotOwner();
    error NotUniversalExecutor();
    error TxAlreadyExecuted(bytes32 txId);
    error ZeroAddress();
    error NotConfigured();
    error InsufficientPC(uint256 required, uint256 available);

    struct Multicall {
        address to;
        uint256 value;
        bytes data;
    }

    // -------------------------------------------------------------------------
    // Constructor / Setup
    // -------------------------------------------------------------------------

    constructor(address _ugpc, address _module) {
        if (_ugpc == address(0) || _module == address(0)) revert ZeroAddress();
        ugpc = _ugpc;
        universalExecutorModule = _module;
        owner = msg.sender;
    }

    function fund() external payable {
        emit Funded(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Owner-only. Set the BNB-side action that the BNB CEA's
    /// outer multicall will execute as its first step.
    function configureBnbTarget(
        address _bnbDestinationContract,
        bytes calldata _bnbDestinationCalldata
    ) external {
        if (msg.sender != owner) revert NotOwner();
        if (_bnbDestinationContract == address(0)) revert ZeroAddress();
        bnbDestinationContract = _bnbDestinationContract;
        bnbDestinationCalldata = _bnbDestinationCalldata;
        emit ConfiguredBnbTarget(_bnbDestinationContract, _bnbDestinationCalldata);
    }

    /// @notice Owner-only. Set the Solana destination CEA + payload bytes
    /// that the executeUniversalTx callback will dispatch to.
    function configureSolanaTarget(
        bytes calldata _solanaCEABytes,
        bytes calldata _solanaPayload
    ) external {
        if (msg.sender != owner) revert NotOwner();
        if (_solanaCEABytes.length == 0 || _solanaPayload.length == 0) revert ZeroAddress();
        solanaCEABytes = _solanaCEABytes;
        solanaPayload = _solanaPayload;
        emit ConfiguredSolanaTarget(_solanaCEABytes, _solanaPayload);
    }

    // -------------------------------------------------------------------------
    // Step 1: kickOff — Push contract → UGPC → BNB CEA
    // -------------------------------------------------------------------------

    /// @notice Dispatch the first leg (Push → BNB) with a back-leg pivot.
    /// @param bnbCEAAddr This contract's CEA on BNB (= deriveExecutorAccount(this, BNB_TESTNET)).
    /// @param protocolFeePc PC the contract forwards to UGPC for outbound 1.
    /// @param ueaNonce UEA nonce on Push for back-leg replay protection (0 for fresh).
    function kickOff(
        address bnbCEAAddr,
        uint256 protocolFeePc,
        uint256 ueaNonce
    ) external {
        if (bnbDestinationContract == address(0)) revert NotConfigured();
        if (solanaCEABytes.length == 0) revert NotConfigured();
        if (bnbCEAAddr == address(0)) revert ZeroAddress();
        if (address(this).balance < protocolFeePc) {
            revert InsufficientPC(protocolFeePc, address(this).balance);
        }

        // Layer 1: BNB-side action — call the configured BNB target.
        Multicall[] memory bnbCalls = new Multicall[](1);
        bnbCalls[0] = Multicall({
            to: bnbDestinationContract,
            value: 0,
            data: bnbDestinationCalldata
        });

        // Layer 2: encoded UniversalPayload (vType=1, inbound) — what TSS
        // delivers to this contract's executeUniversalTx as the back-leg.
        // The "data" field can be a sentinel since this contract handles
        // its own routing in executeUniversalTx (doesn't decode the payload).
        bytes memory dummyInner = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(new Multicall[](0))
        );
        bytes memory inboundUniversalPayload = abi.encode(
            address(0), uint256(0), dummyInner,
            uint256(1e7), uint256(1e10), uint256(0),
            ueaNonce + 1, uint256(9999999999), uint8(1)
        );

        // Layer 3: CEA's sendUniversalTxToUEA self-call — the trigger that
        // fires the back-leg.
        bytes memory ceaSelfCallData = abi.encodeWithSelector(
            bytes4(keccak256("sendUniversalTxToUEA(address,uint256,bytes,address)")),
            address(0), uint256(0), inboundUniversalPayload, address(this)
        );

        // Layer 4: outer multicall = [bnbAction, ceaSelfCall].
        Multicall[] memory outerCalls = new Multicall[](2);
        outerCalls[0] = bnbCalls[0];                          // BNB action
        outerCalls[1] = Multicall({                           // CEA self-call
            to: bnbCEAAddr,
            value: 0,
            data: ceaSelfCallData
        });
        bytes memory outerMulticallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(outerCalls)
        );

        UniversalOutboundTxRequest memory req = UniversalOutboundTxRequest({
            target: abi.encodePacked(bnbCEAAddr),
            token: PBNB,
            amount: 0,
            gasLimit: 2_000_000,
            payload: outerMulticallData,
            revertRecipient: address(this)
        });

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: protocolFeePc}(req);

        kickOffCount += 1;
        emit KickedOff(kickOffCount, outerMulticallData);
    }

    // -------------------------------------------------------------------------
    // Step 2: executeUniversalTx — receives the BNB back-leg, then fires
    //   the SECOND outbound to Solana.
    // -------------------------------------------------------------------------

    function executeUniversalTx(
        string calldata /* sourceChainNamespace */,
        bytes calldata /* ceaAddress */,
        bytes calldata /* payload */,
        uint256 /* amount */,
        address /* prc20 */,
        bytes32 txId
    ) external payable {
        if (msg.sender != universalExecutorModule) revert NotUniversalExecutor();
        if (seenInboundTxIds[txId]) revert TxAlreadyExecuted(txId);
        seenInboundTxIds[txId] = true;
        bnbBackLegCount += 1;
        lastInboundTxId = txId;
        emit BnbBackLegLanded(txId, bnbBackLegCount);

        // Now dispatch to Solana — the cascade's third leg.
        _dispatchSolanaOutbound();
    }

    // -------------------------------------------------------------------------
    // Step 3: dispatch to Solana (called from executeUniversalTx)
    // -------------------------------------------------------------------------

    /// @notice Compute the protocol fee for the Solana outbound and dispatch.
    /// Called automatically when the BNB back-leg lands. Uses up to half of
    /// `address(this).balance` as the fee — UGPC refunds surplus back into
    /// `address(this)` via `receive()`.
    function _dispatchSolanaOutbound() internal {
        uint256 fee = address(this).balance / 2;
        if (fee == 0) revert InsufficientPC(1, 0);

        UniversalOutboundTxRequest memory req = UniversalOutboundTxRequest({
            target: solanaCEABytes,        // 32-byte Solana program-derived address
            token: PSOL,
            amount: 0,
            gasLimit: 2_000_000,
            payload: solanaPayload,        // pre-encoded Anchor instruction
            revertRecipient: address(this)
        });

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: fee}(req);

        solanaDispatchCount += 1;
        emit SolanaDispatched(solanaDispatchCount, solanaPayload);
    }

    /// @notice Manual dispatcher — useful if the auto-trigger inside
    /// executeUniversalTx fails (e.g., contract ran out of PC). Owner-only.
    function dispatchSolanaManually() external {
        if (msg.sender != owner) revert NotOwner();
        _dispatchSolanaOutbound();
    }

    receive() external payable {}
}
