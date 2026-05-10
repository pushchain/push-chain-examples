// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// PushCounter
// ===========
// A trivial counter living on Push Chain. The inbound demo's
// EthereumInboundDispatcher (deployed on Sepolia) triggers `increment()`
// from the Sepolia contract's UEA on Push Chain — so `lastCaller` will be
// that UEA address, not the EOA that sent the Sepolia tx.

contract PushCounter {
    uint256 public count;
    address public lastCaller;

    event Incremented(address indexed caller, uint256 newCount);

    function increment() external {
        count += 1;
        lastCaller = msg.sender;
        emit Incremented(msg.sender, count);
    }
}
