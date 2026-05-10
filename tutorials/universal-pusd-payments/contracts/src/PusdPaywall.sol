// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @notice Minimal PUSD interface — only the bits this paywall needs.
interface IPUSD {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title PusdPaywall — pay 1 PUSD, get 30 days of access
/// @notice A minimal subscription contract that accepts PUSD as payment. Users
///         from any chain can pay because every cross-chain caller arrives
///         through their deterministic UEA on Push Chain — `msg.sender` is the
///         caller's UEA and `expiresAt[msg.sender]` therefore tracks per-user
///         access correctly without any chain-specific logic in this contract.
///
/// @dev    Pairs cleanly with multicall on the universal transaction layer:
///         a single signature can `approve(PUSD, this, FEE) + pay()`. If the
///         caller doesn't yet hold PUSD, the multicall can prepend a PUSD mint
///         (`approve + PUSDManager.deposit`) so the entire flow — bridge
///         reserve token, mint PUSD, approve, pay — runs in one signature.
contract PusdPaywall {
    /// @notice PUSD token (proxy) on Push Chain Donut Testnet.
    IPUSD public constant PUSD = IPUSD(0x488d080e16386379561a47A4955D22001d8A9D89);

    /// @notice Per-subscription cost in PUSD's smallest unit (6 decimals → 1 PUSD).
    uint256 public constant FEE = 1_000_000;

    /// @notice How long one payment extends access for.
    uint256 public constant DURATION = 30 days;

    /// @notice The treasury that owns collected PUSD. Set at deployment.
    address public immutable owner;

    /// @notice Per-user access expiry (unix seconds). 0 means never paid.
    mapping(address => uint256) public expiresAt;

    /// @dev Emitted on every successful payment so frontends/indexers can
    ///      surface the new expiry without re-reading state.
    event AccessGranted(address indexed user, uint256 expiresAt, uint256 paid);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address _owner) {
        require(_owner != address(0), "PusdPaywall: zero owner");
        owner = _owner;
    }

    /// @notice Pay 1 PUSD, get/extend 30 days of access. Requires the caller
    ///         to have approved this contract for `FEE` PUSD beforehand
    ///         (typically batched in the same multicall — see the tutorial's
    ///         frontend).
    /// @dev    Stacks: if the caller still has time left, the new expiry is
    ///         (currentExpiry + DURATION); otherwise (now + DURATION). Stops
    ///         early-renewals from losing time.
    function pay() external {
        require(PUSD.transferFrom(msg.sender, address(this), FEE), "PusdPaywall: PUSD pull failed");

        uint256 current = expiresAt[msg.sender];
        uint256 base = current > block.timestamp ? current : block.timestamp;
        uint256 newExpiry = base + DURATION;

        expiresAt[msg.sender] = newExpiry;
        emit AccessGranted(msg.sender, newExpiry, FEE);
    }

    /// @notice True if `user` has paid and their access hasn't expired yet.
    function hasAccess(address user) external view returns (bool) {
        return expiresAt[user] > block.timestamp;
    }

    /// @notice Owner-only PUSD withdrawal. Pays out collected fees.
    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "PusdPaywall: only owner");
        require(PUSD.transfer(owner, amount), "PusdPaywall: PUSD transfer failed");
        emit Withdrawn(owner, amount);
    }
}
