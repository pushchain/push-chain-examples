// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

struct UniversalAccountId {
    // @notice Chain namespace identifier (e.g., "eip155" or "solana").
    string chainNamespace;
    // @notice Chain ID of the source chain of the owner of this UEA.
    string chainId;
    // @notice Owner's public key or address in bytes format.
    bytes owner;
}

interface IUEAFactory {
    /**
     * @notice Returns the Universal Account information and type for a given address on Push Chain.
     * @param addr The address to query (typically msg.sender).
     * @return account The Universal Account information associated with this UEA.
     * @return isUEA True if the address is a UEA contract, false if it is a native EOA of Push Chain.
     */
    function getOriginForUEA(address addr) external view returns (UniversalAccountId memory account, bool isUEA);
}

/**
 * @title UniversalCounter
 * @notice Tracks and increments counters for users from different blockchains (Ethereum, Solana, Push Chain) natively.
 * @dev Uses Push Chain's UEA system to identify the origin chain of the caller and increments the appropriate counter.
 */
contract UniversalCounter {
    /// @notice Counter for Ethereum users (chainNamespace: "eip155", chainId: "1").
    uint256 public countEth;
    /// @notice Counter for Solana users (chainNamespace: "solana", chainId: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp").
    uint256 public countSol;
    /// @notice Counter for native Push Chain users (EOA, not UEA).
    uint256 public countPC;

    /**
     * @notice Emitted when the counter is incremented by any user.
     * @param newCount The new total count after increment.
     * @param caller The address of the user who called increment().
     * @param chainNamespace The namespace of the caller's origin chain (e.g., "eip155", "solana").
     * @param chainId The chain ID of the caller's origin chain (e.g., "1" for Ethereum mainnet).
     */
    event CountIncremented(
        uint256 newCount,
        address indexed caller,
        string chainNamespace,
        string chainId
    );

    /**
     * @notice Initializes the Counter contract.
     * @dev No special initialization logic required.
     */
    constructor() {}

    /**
     * @notice Increments the counter for the caller's origin chain.
     * @dev Uses IUEAFactory to determine the caller's chain. Increments the appropriate counter based on the chain.
     *      - If the caller is a native Push Chain EOA, increments countPC.
     *      - If the caller is a UEA from Solana, increments countSol.
     *      - If the caller is a UEA from Ethereum, increments countEth.
     *      - Reverts for unsupported chains.
     * @custom:example
     *      - Bob (Ethereum user) calls increment() -> countEth is incremented.
     *      - Dan (Push Chain user) calls increment() -> countPC is incremented.
     */
    function increment() public {
        address caller = msg.sender;
        (UniversalAccountId memory originAccount, bool isUEA) = 
            IUEAFactory(0x00000000000000000000000000000000000000eA).getOriginForUEA(caller);

        if (!isUEA) {
            // If it's a native Push Chain EOA (isUEA = false)
            countPC += 1;
        } else {
            bytes32 chainHash = keccak256(abi.encodePacked(originAccount.chainNamespace, originAccount.chainId));

            if (chainHash == keccak256(abi.encodePacked("solana","EtWTRABZaYq6iMfeYKouRu166VU2xqa1"))) {
                countSol += 1;
            } else if (chainHash == keccak256(abi.encodePacked("eip155","11155111"))) {
                countEth += 1;
            } else {
                revert("Invalid chain");
            }
        }

        emit CountIncremented(getCount(), caller, originAccount.chainNamespace, originAccount.chainId);
    }

    /**
     * @notice Returns the total count across all chains.
     * @return The sum of countEth, countSol, and countPC.
     */
    function getCount() public view returns (uint256) {
        return countEth + countSol + countPC;
    }
}