// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// RoundtripWithResult
// ===================
// Real-world variation of the bare round-trip: instead of just bumping a
// counter, the inbound callback decodes a payload that the outbound encoded
// and uses it to drive **application state**. Demonstrates how a Push contract
// can request external-chain work and act on the returned data.
//
// **Pattern**: a "request → fulfill" cycle.
//   1. User calls `request(externalContract, externalCalldata)` on Push.
//   2. The contract assigns a `requestId`, marks it pending, dispatches
//      outbound to the BNB CEA. The outbound's inboundUniversalPayload
//      includes a multicall step that calls back into THIS contract's
//      `fulfillRequest(bytes32 requestId, bytes data)` with the requestId
//      embedded — so when the callback fires, we know which request lands.
//   3. TSS dispatches the inbound; the contract's docs-style executeUniversalTx
//      decodes the requestId from `payload`, marks the request fulfilled,
//      stores the data, and emits Fulfilled.
//
// What stays the same as `contract-initiated-roundtrip-execution/`:
//   - SDK Route 3 wire format (CEA self-call to `sendUniversalTxToUEA`)
//   - gasLimit = 2_000_000 on UGPC outbound
//   - PC funding model (contract holds PC, kickOff spends from it)
//   - Docs-style 6-arg executeUniversalTx is what TSS dispatches to

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

contract RoundtripWithResult {
    address public immutable ugpc;
    address public immutable universalExecutorModule;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    enum RequestStatus { None, Pending, Fulfilled }

    struct Request {
        RequestStatus status;
        bytes32 destinationTxOrTag; // encoded by the user; e.g. a tx hash, a job id
        uint256 createdAt;
        uint256 fulfilledAt;
        bytes resultData;
    }

    /// @notice Counter producing unique requestIds.
    uint256 public nextRequestSeq;

    /// @notice requestId → request state.
    mapping(bytes32 => Request) public requests;

    /// @notice Replay protection on inbound callbacks.
    mapping(bytes32 => bool) public seenInboundTxIds;

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event Requested(
        bytes32 indexed requestId,
        address externalContract,
        bytes externalCalldata,
        bytes32 tag
    );
    event Fulfilled(
        bytes32 indexed requestId,
        bytes32 indexed inboundTxId,
        string sourceChainNamespace,
        bytes resultData
    );

    error NotUniversalExecutor();
    error ZeroAddress();
    error AlreadySeen(bytes32 inboundTxId);
    error UnknownRequest(bytes32 requestId);
    error AlreadyFulfilled(bytes32 requestId);
    error InsufficientPC(uint256 required, uint256 available);

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

    /// @notice Initiate a "request" against an external chain. The destination
    /// CEA executes `externalCalldata` on `externalContract`, and a callback
    /// fires back to this contract with a payload tying the result to
    /// `requestId`.
    /// @param destinationCEAAddr This contract's CEA on the destination chain.
    /// @param tokenForRouting PRC-20 selecting the destination chain (e.g. pBNB).
    /// @param protocolFeePc PC the contract forwards to UGPC.
    /// @param ueaNonce Push UEA nonce. 0 for fresh.
    /// @param tag Application-level identifier (e.g. user-defined job tag) —
    ///     stored on the request and emitted in Requested.
    function request(
        address destinationCEAAddr,
        address tokenForRouting,
        uint256 protocolFeePc,
        uint256 ueaNonce,
        bytes32 tag
    ) external returns (bytes32 requestId) {
        if (destinationCEAAddr == address(0)) revert ZeroAddress();
        if (address(this).balance < protocolFeePc) {
            revert InsufficientPC(protocolFeePc, address(this).balance);
        }

        // Generate a deterministic-but-unique requestId for this dispatch.
        requestId = keccak256(abi.encodePacked(address(this), nextRequestSeq, block.timestamp, tag));
        nextRequestSeq += 1;
        requests[requestId] = Request({
            status: RequestStatus.Pending,
            destinationTxOrTag: tag,
            createdAt: block.timestamp,
            fulfilledAt: 0,
            resultData: ""
        });

        // ---- Layer 1: inner multicall — when the callback's payload is
        //      decoded, we want to be able to recover the requestId. We
        //      encode an "echo" of the requestId through the inboundUniversalPayload
        //      using the standard multicall mechanism. The callback is
        //      delivered via the docs-style 6-arg executeUniversalTx with
        //      `payload = inboundUniversalPayload` — which we'll inspect to
        //      pick out the requestId. -----------------------------------
        // For this example we make the inner multicall a no-op that simply
        // carries the requestId in the multicall's `data` field. The
        // executeUniversalTx callback receives the FULL UniversalPayload bytes
        // as its `payload` arg, so we can grep out our requestId from there.
        Multicall[] memory innerCalls = new Multicall[](1);
        innerCalls[0] = Multicall({to: address(this), value: 0, data: abi.encode(requestId)});
        bytes memory innerMulticallData = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(innerCalls)
        );

        // ---- Layer 2: encoded UniversalPayload (vType=1, inbound) -----
        bytes memory inboundUniversalPayload = abi.encode(
            address(0), uint256(0), innerMulticallData,
            uint256(1e7), uint256(1e10), uint256(0),
            ueaNonce + 1, uint256(9999999999), uint8(1)
        );

        // ---- Layer 3: CEA self-call to sendUniversalTxToUEA ---------
        bytes memory ceaSelfCallData = abi.encodeWithSelector(
            bytes4(keccak256("sendUniversalTxToUEA(address,uint256,bytes,address)")),
            address(0), uint256(0), inboundUniversalPayload, address(this)
        );

        // ---- Layer 4: outer multicall destination CEA executes -------
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

        // ---- Dispatch via UGPC -------------------------------------
        bytes memory targetBytes = abi.encodePacked(destinationCEAAddr);
        UniversalOutboundTxRequest memory req = UniversalOutboundTxRequest({
            target: targetBytes,
            token: tokenForRouting,
            amount: 0,
            gasLimit: 2_000_000,
            payload: outerMulticallData,
            revertRecipient: address(this)
        });

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: protocolFeePc}(req);

        emit Requested(requestId, destinationCEAAddr, ceaSelfCallData, tag);
    }

    /// @notice TSS-delivered inbound callback (docs-style 6-arg signature).
    /// Decodes the inbound `payload` to extract the requestId we encoded
    /// into the outbound's inner multicall, then marks that request fulfilled.
    function executeUniversalTx(
        string calldata sourceChainNamespace,
        bytes calldata /* ceaAddress */,
        bytes calldata payload,
        uint256 /* amount */,
        address /* prc20 */,
        bytes32 txId
    ) external payable {
        if (msg.sender != universalExecutorModule) revert NotUniversalExecutor();
        if (seenInboundTxIds[txId]) revert AlreadySeen(txId);
        seenInboundTxIds[txId] = true;

        // The `payload` here is the encoded UniversalPayload struct we built
        // on the outbound side (fields: to, value, data, gasLimit, ...). The
        // `data` field within is `0x2cc2842d || abi.encode(Multicall[])` and
        // the Multicall[0].data is `abi.encode(requestId)`. We unwrap layer
        // by layer to get the requestId.
        bytes32 requestId = _extractRequestIdFromInboundPayload(payload);

        Request storage r = requests[requestId];
        if (r.status == RequestStatus.None) revert UnknownRequest(requestId);
        if (r.status == RequestStatus.Fulfilled) revert AlreadyFulfilled(requestId);

        r.status = RequestStatus.Fulfilled;
        r.fulfilledAt = block.timestamp;
        r.resultData = payload;

        emit Fulfilled(requestId, txId, sourceChainNamespace, payload);
    }

    /// @notice Decodes the inbound payload (an encoded UniversalPayload) and
    /// returns the requestId we packed into the inner multicall's `data` field.
    function _extractRequestIdFromInboundPayload(bytes calldata payload)
        internal
        pure
        returns (bytes32)
    {
        // UniversalPayload struct layout: (address, uint256, bytes data, ...).
        // Decode and grab `data` (the multicall blob).
        (
            ,
            ,
            bytes memory inner,
            ,
            ,
            ,
            ,
            ,
        ) = abi.decode(
            payload,
            (address, uint256, bytes, uint256, uint256, uint256, uint256, uint256, uint8)
        );

        // `inner` = 0x2cc2842d || abi.encode(Multicall[]). Strip the 4-byte selector.
        require(inner.length >= 4, "inner too short");
        bytes memory innerWithoutSel = new bytes(inner.length - 4);
        for (uint256 i = 0; i < innerWithoutSel.length; i++) {
            innerWithoutSel[i] = inner[i + 4];
        }
        Multicall[] memory calls = abi.decode(innerWithoutSel, (Multicall[]));
        require(calls.length > 0, "no multicall");

        // We packed `abi.encode(requestId)` (= 32-byte right-padded) into calls[0].data.
        return abi.decode(calls[0].data, (bytes32));
    }

    receive() external payable {}
}
