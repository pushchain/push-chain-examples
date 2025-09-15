// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

contract Counter {
    uint256 public countPC;
    event CountIncremented(uint256 indexed countPC, address indexed caller);
    
    function increment() public {
        countPC += 1;
        emit CountIncremented(countPC, msg.sender);
    }
} 