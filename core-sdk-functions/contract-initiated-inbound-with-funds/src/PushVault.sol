// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// PushVault
// =========
// A trivial deposit-style target on Push Chain. The inbound-with-funds demo
// calls `deposit(address beneficiary)` with `msg.value > 0` — the deposit
// is credited to `beneficiary`. In a real app this would credit yield-bearing
// shares, NFT mints, escrow positions, etc.

contract PushVault {
    /// @notice Total deposit balance per beneficiary in wei.
    mapping(address => uint256) public depositOf;

    /// @notice Last caller (the UEA on Push that invoked deposit).
    address public lastDepositor;

    /// @notice Total cumulative deposits handled.
    uint256 public totalDeposits;

    event Deposited(
        address indexed depositor,
        address indexed beneficiary,
        uint256 amount,
        uint256 newBalance
    );

    error ZeroAddress();
    error ZeroValue();

    function deposit(address beneficiary) external payable {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroValue();
        depositOf[beneficiary] += msg.value;
        totalDeposits += msg.value;
        lastDepositor = msg.sender;
        emit Deposited(msg.sender, beneficiary, msg.value, depositOf[beneficiary]);
    }
}
