// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title  ExternalCounter
/// @notice Lives on Ethereum / BNB / Base / etc. Stores a per-chain count and
///         emits the caller for traceability — anyone can call `increment()`.
///
/// @dev    For production you'll typically gate `increment()` to a known
///         caller. The natural fit on Push Chain is the orchestrator's
///         deterministic CEA on this chain — derive it via the SDK or via
///         `ICEAFactory.getCEAForPushAccount(orchestratorOnPush)`, store it as
///         an immutable in the constructor, and require `msg.sender == cea`.
///         The tutorial deliberately leaves `increment()` public so you can
///         try the playground without per-chain redeploys.
contract ExternalCounter {
    uint256 public count;

    /// @notice The address that most recently incremented this counter.
    /// When the orchestrator's CEA on this chain is the caller, this will be
    /// the deterministic CEA address — visible proof that the same Push-side
    /// contract drove every destination tick.
    address public lastCaller;

    event CountIncremented(uint256 indexed newCount, address indexed caller);

    constructor() {}

    function increment() external {
        unchecked { count += 1; }
        lastCaller = msg.sender;
        emit CountIncremented(count, msg.sender);
    }
}
