// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice UGPC outbound request shape. Mirrors the production type so this
/// tutorial doesn't need a hard dependency on push-chain-gateway-contracts.
struct UniversalOutboundTxRequest {
    bytes recipient;        // bytes-packed ExternalCounter address on the destination chain
    address token;          // PRC20 on Push that maps to the destination chain (e.g. pETH)
    uint256 amount;         // 0 — we are not bridging funds
    uint256 gasLimit;       // gas the destination CEA gets to run `increment()`
    bytes payload;          // ABI-encoded calldata for the destination contract
    address revertRecipient; // refunded if the outbound cannot finalise
}

interface IUniversalGatewayPC {
    function sendUniversalTxOutbound(UniversalOutboundTxRequest calldata req) external payable;
}

interface IExternalCounter {
    function increment() external;
}

/// @title  MultiChainCounter
/// @notice One Push Chain orchestrator that ticks an `ExternalCounter` on every
///         configured destination chain in a single transaction.
contract MultiChainCounter {
    /// @notice Predeploy address of UniversalGatewayPC on every Push Chain network.
    IUniversalGatewayPC public constant UGPC =
        IUniversalGatewayPC(0x00000000000000000000000000000000000000C1);

    struct Destination {
        bytes target;        // bytes-packed ExternalCounter address
        address chainToken;  // PRC20 on Push (pETH for Ethereum-family, pBNB for BSC, …)
        uint256 gasLimit;    // destination-chain gas budget for the CEA's call
    }

    Destination[] public destinations;
    address public immutable OWNER;

    event DestinationAdded(uint256 indexed index, bytes target, address chainToken);
    event DestinationGasLimitUpdated(uint256 indexed index, uint256 oldGasLimit, uint256 newGasLimit);
    event Ticked(uint256 nDestinations, uint256 totalValue);

    error NotOwner();
    error LengthMismatch();
    error InsufficientValue();
    error InvalidIndex();
    error ZeroGasLimit();

    modifier onlyOwner() {
        if (msg.sender != OWNER) revert NotOwner();
        _;
    }

    constructor() {
        OWNER = msg.sender;
    }

    /// @notice Register an `ExternalCounter` on a specific destination chain.
    /// @dev    Off-chain workflow:
    ///         1. Derive THIS contract's CEA on the destination chain via the SDK
    ///            (`PushChain.utils.account.deriveExecutorAccount`) or the
    ///            destination's `ICEAFactory.getCEAForPushAccount`.
    ///         2. Deploy `ExternalCounter` on the destination with that CEA as
    ///            constructor arg so it gates `increment()` to that CEA.
    ///         3. Call this function with the deployed `ExternalCounter` address
    ///            (bytes-packed) and the matching PRC-20 routing token on Push.
    function addDestination(
        bytes calldata target,
        address chainToken,
        uint256 gasLimit
    ) external onlyOwner {
        destinations.push(Destination({
            target: target,
            chainToken: chainToken,
            gasLimit: gasLimit
        }));
        emit DestinationAdded(destinations.length - 1, target, chainToken);
    }

    /// @notice Update the gas budget granted to a registered destination's CEA.
    /// @dev    Lets you tune gas per destination without redeploying when you
    ///         hit `0xff633a38`-style destination reverts that mean "the CEA's
    ///         tx ran out of gas executing the multicall". Different chains
    ///         (and different destination targets) need different budgets.
    function setDestinationGasLimit(uint256 index, uint256 newGasLimit) external onlyOwner {
        if (index >= destinations.length) revert InvalidIndex();
        if (newGasLimit == 0) revert ZeroGasLimit();
        uint256 oldGasLimit = destinations[index].gasLimit;
        destinations[index].gasLimit = newGasLimit;
        emit DestinationGasLimitUpdated(index, oldGasLimit, newGasLimit);
    }

    /// @notice Tick every registered destination's counter.
    /// @param  perCallFee  protocolFee + gasFee for each destination, quoted via
    ///                     `UniversalCore.getOutboundTxGasAndFees(token, gasLimit)`.
    ///                     Must be one entry per destination, in registration order.
    /// @param  revertRecipient Push-side address credited if any outbound reverts.
    /// @dev    `msg.value` must equal the sum of `perCallFee`. Surplus is refunded
    ///         by UniversalCore back to this contract via the `receive()` hook.
    function tickAll(
        uint256[] calldata perCallFee,
        address revertRecipient
    ) external payable {
        _tickAll(perCallFee, revertRecipient, _emptyGasOverrides());
    }

    /// @notice Same as `tickAll` but accepts per-destination gas overrides for
    ///         this single call — useful when you need to bump gas for one
    ///         destination without persisting the change via
    ///         `setDestinationGasLimit`. Pass 0 in any slot to fall back to
    ///         the registered `destinations[i].gasLimit`.
    function tickAllWithGas(
        uint256[] calldata perCallFee,
        address revertRecipient,
        uint256[] calldata gasLimitOverrides
    ) external payable {
        if (gasLimitOverrides.length != destinations.length) revert LengthMismatch();
        _tickAll(perCallFee, revertRecipient, gasLimitOverrides);
    }

    function _tickAll(
        uint256[] calldata perCallFee,
        address revertRecipient,
        uint256[] memory gasLimitOverrides
    ) internal {
        if (perCallFee.length != destinations.length) revert LengthMismatch();

        bytes memory payload = abi.encodeCall(IExternalCounter.increment, ());

        uint256 total;
        uint256 n = destinations.length;
        for (uint256 i = 0; i < n; i++) {
            Destination memory d = destinations[i];
            uint256 gas = gasLimitOverrides.length == n && gasLimitOverrides[i] > 0
                ? gasLimitOverrides[i]
                : d.gasLimit;

            UGPC.sendUniversalTxOutbound{value: perCallFee[i]}(
                UniversalOutboundTxRequest({
                    recipient: d.target,
                    token: d.chainToken,
                    amount: 0,
                    gasLimit: gas,
                    payload: payload,
                    revertRecipient: revertRecipient
                })
            );
            total += perCallFee[i];
        }

        if (msg.value < total) revert InsufficientValue();

        emit Ticked(n, msg.value);
    }

    function _emptyGasOverrides() private pure returns (uint256[] memory) {
        return new uint256[](0);
    }

    /// @notice View helper — returns the number of registered destinations.
    function destinationCount() external view returns (uint256) {
        return destinations.length;
    }

    /// @notice Receive UniversalCore refunds and any incoming PC.
    receive() external payable {}
}
