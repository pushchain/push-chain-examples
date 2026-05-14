// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// RoundtripWithResult
// ===================
// "External action done → do action here." Push contract dispatches outbound
// to BNB Testnet. The destination CEA's outer multicall does TWO things:
//
//   1. **External action.** Calls `bnbCounter.increment()` — a real BNB-side
//      state change.
//   2. **Self-call to `sendUniversalTxToUEA`.** Triggers the back-leg.
//
// When the back-leg lands on this contract via `executeUniversalTx`, we run
// the **Push action**: pop the oldest pending request off a FIFO queue and
// mark it `Fulfilled`. That state change is what application code reacts to.
//
// Why FIFO instead of decoding requestId from the inbound payload?
// ----------------------------------------------------------------
// TSS relays back-leg callbacks in the same order the outbound legs were
// submitted. The decoder approach (extract requestId from `payload` bytes
// inside the inbound `UniversalPayload`) is fragile — TSS-delivered bytes
// don't always round-trip through `abi.decode` cleanly. A queue is simpler,
// uses no payload introspection, and matches the natural ordering.
//
//   [Push EOA] ──request()──▶ this contract ──UGPC──▶ [BNB CEA]
//                                  ▲                    │
//                                  │                    │ outer multicall:
//                                  │                    │   step 1: bnbCounter.increment()
//                                  │                    │   step 2: CEA.sendUniversalTxToUEA(self-call)
//                                  │                    ▼
//                                  │            gateway.sendUniversalTxFromCEA
//                                  │                    │
//                                  │                    ▼
//                          executeUniversalTx ◀──── TSS Cosmos universal-executor
//                          (pops queue, marks request Fulfilled)

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

contract RoundtripWithResult {
    address public immutable ugpc;
    address public immutable universalExecutorModule;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;
    bytes4 internal constant INCREMENT_SELECTOR = 0xd09de08a; // bytes4(keccak256("increment()"))

    enum RequestStatus { None, Pending, Fulfilled }

    struct Request {
        RequestStatus status;
        bytes32 tag;            // application-level tag passed by caller
        uint256 createdAt;      // block.timestamp on Push when request() called
        uint256 fulfilledAt;    // block.timestamp on Push when callback landed
        bytes32 inboundTxId;    // TSS-supplied txId of the inbound callback
    }

    /// @notice Sequence counter producing unique requestIds.
    uint256 public nextRequestSeq;

    /// @notice Total fulfilled requests (the "Push action" counter — bumped
    /// on every successful inbound callback).
    uint256 public fulfilledCount;

    /// @notice requestId → request state.
    mapping(bytes32 => Request) public requests;

    /// @notice FIFO queue of pending requestIds (head moves forward; tail grows
    /// on each `request()` call).
    bytes32[] public pendingQueue;
    uint256 public pendingHead;

    /// @notice Replay protection on inbound callbacks.
    mapping(bytes32 => bool) public seenInboundTxIds;

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event Requested(
        bytes32 indexed requestId,
        address bnbCounter,
        address bnbCEA,
        bytes32 tag,
        uint256 queuePosition
    );
    event Fulfilled(
        bytes32 indexed requestId,
        bytes32 indexed inboundTxId,
        string sourceChainNamespace,
        uint256 fulfilledCount
    );

    error NotUniversalExecutor();
    error ZeroAddress();
    error AlreadySeen(bytes32 inboundTxId);
    error NoPendingRequest();
    error InsufficientPC(uint256 required, uint256 available);

    struct Multicall {
        address to;
        uint256 value;
        bytes data;
    }

    constructor(address _ugpc, address _module) {
        if (_ugpc == address(0) || _module == address(0)) revert ZeroAddress();
        ugpc = _ugpc;
        universalExecutorModule = _module;
    }

    function fund() external payable {
        emit Funded(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Initiate a request: BNB-side `bnbCounter.increment()` runs,
    /// callback fires back, oldest pending request is marked Fulfilled.
    /// @param bnbCounter The counter contract on BNB Testnet to increment.
    /// @param bnbCEAAddr This contract's CEA on BNB (deriveExecutorAccount).
    /// @param tokenForRouting PRC-20 selecting the destination chain (e.g. pBNB).
    /// @param protocolFeePc PC the contract forwards to UGPC.
    /// @param ueaNonce Push UEA nonce. 0 for fresh.
    /// @param tag Application tag — stored on the request and emitted.
    function request(
        address bnbCounter,
        address bnbCEAAddr,
        address tokenForRouting,
        uint256 protocolFeePc,
        uint256 ueaNonce,
        bytes32 tag
    ) external returns (bytes32 requestId) {
        if (bnbCounter == address(0) || bnbCEAAddr == address(0)) revert ZeroAddress();
        if (address(this).balance < protocolFeePc) {
            revert InsufficientPC(protocolFeePc, address(this).balance);
        }

        requestId = keccak256(abi.encodePacked(address(this), nextRequestSeq, block.timestamp, tag));
        nextRequestSeq += 1;
        requests[requestId] = Request({
            status: RequestStatus.Pending,
            tag: tag,
            createdAt: block.timestamp,
            fulfilledAt: 0,
            inboundTxId: bytes32(0)
        });
        pendingQueue.push(requestId);

        bytes memory outerMulticallData = _buildOuterMulticall(bnbCounter, bnbCEAAddr, ueaNonce);

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: protocolFeePc}(
            UniversalOutboundTxRequest({
                recipient: abi.encodePacked(bnbCEAAddr),
                token: tokenForRouting,
                amount: 0,
                gasLimit: 2_000_000,
                gasPrice: 0,
                maxPCForGas: 0,
                payload: outerMulticallData,
                revertRecipient: address(this)
            })
        );

        emit Requested(requestId, bnbCounter, bnbCEAAddr, tag, pendingQueue.length - 1);
    }

    /// @dev Builds the full outer multicall blob the destination CEA executes:
    ///   step 1: bnbCounter.increment() — the EXTERNAL action
    ///   step 2: CEA self-call to sendUniversalTxToUEA — triggers the back-leg
    function _buildOuterMulticall(
        address bnbCounter,
        address bnbCEAAddr,
        uint256 ueaNonce
    ) internal view returns (bytes memory) {
        // Layer 1: a no-op inner multicall — the back-leg's Push-side action
        // is a state change in this contract, not a multicall step.
        Multicall[] memory innerCalls = new Multicall[](1);
        innerCalls[0] = Multicall({to: address(this), value: 0, data: ""});
        bytes memory innerMulticallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(innerCalls)
        );

        // Layer 2: encoded UniversalPayload (vType=1, inbound).
        bytes memory inboundUniversalPayload = abi.encode(
            address(0), uint256(0), innerMulticallData,
            uint256(1e7), uint256(1e10), uint256(0),
            ueaNonce + 1, uint256(9999999999), uint8(1)
        );

        // Layer 3: CEA self-call to sendUniversalTxToUEA.
        bytes memory ceaSelfCallData = abi.encodeWithSelector(
            bytes4(keccak256("sendUniversalTxToUEA(address,uint256,bytes,address)")),
            address(0), uint256(0), inboundUniversalPayload, address(this)
        );

        // Layer 4: outer multicall the destination CEA executes.
        Multicall[] memory outerCalls = new Multicall[](2);
        outerCalls[0] = Multicall({
            to: bnbCounter,
            value: 0,
            data: abi.encodePacked(INCREMENT_SELECTOR)
        });
        outerCalls[1] = Multicall({
            to: bnbCEAAddr,
            value: 0,
            data: ceaSelfCallData
        });
        return abi.encodePacked(UEA_MULTICALL_SELECTOR, abi.encode(outerCalls));
    }

    /// @notice TSS-delivered inbound callback. Pops the oldest pending request
    /// and marks it Fulfilled. No payload decoding — relies on TSS preserving
    /// outbound-submission order in back-leg delivery.
    function executeUniversalTx(
        string calldata sourceChainNamespace,
        bytes calldata /* ceaAddress */,
        bytes calldata /* payload */,
        uint256 /* amount */,
        address /* prc20 */,
        bytes32 txId
    ) external payable {
        if (msg.sender != universalExecutorModule) revert NotUniversalExecutor();
        if (seenInboundTxIds[txId]) revert AlreadySeen(txId);
        seenInboundTxIds[txId] = true;

        if (pendingHead >= pendingQueue.length) revert NoPendingRequest();
        bytes32 requestId = pendingQueue[pendingHead];
        pendingHead += 1;

        Request storage r = requests[requestId];
        r.status = RequestStatus.Fulfilled;
        r.fulfilledAt = block.timestamp;
        r.inboundTxId = txId;
        fulfilledCount += 1;

        emit Fulfilled(requestId, txId, sourceChainNamespace, fulfilledCount);
    }

    /// @notice Convenience: how many requests are still waiting for callback.
    function pendingCount() external view returns (uint256) {
        return pendingQueue.length - pendingHead;
    }

    receive() external payable {}
}
