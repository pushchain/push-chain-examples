// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

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
    /// @notice Counter mapping to maintain individual chain counts
    mapping(bytes => uint256) public chainCount;
    mapping(bytes => uint256) public chainCountUnique;

    /// @notice Array of chain IDs to track unique chains
    bytes[] public chainIds;

    /// @notice Array of chain users to track unique counts
    mapping(address => bool) public chainUsers;

    /**
     * @notice Emitted when the counter is incremented by any user.
     * @param newCount The new total count after increment.
     * @param caller The address of the user who called increment().
     * @param chainNamespace The namespace of the caller's origin chain (e.g., "eip155", "solana").
     * @param chainId The chain ID of the caller's origin chain (e.g., "1" for Ethereum mainnet).
     */
    event CountIncremented(
        uint256 newCount,
        uint256 newCountUnique,
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

        // Calculate chain hash
        bytes memory chainHash = abi.encodePacked(originAccount.chainNamespace, ":", originAccount.chainId);

        if (chainCount[chainHash] == 0) {
            // Add new chain to chainIds if it doesn't exist
            chainIds.push(chainHash);
        }

        if (chainUsers[caller] == false) {
          // add to chain unique count if user is not already counted
          chainCountUnique[chainHash] += 1;
          chainUsers[caller] = true;
        }        
        
        // Add to chain count
        chainCount[chainHash] += 1;

        (uint256 totalCount, uint256 totalCountUnique) = getCount();
        emit CountIncremented(totalCount, totalCountUnique, caller, originAccount.chainNamespace, originAccount.chainId);
    }

    /**
     * @notice Returns the total count across all chains.
     * @return count The sum of all chain counts.
     * @return countUnique The sum of all unique user counts.
     */
    function getCount() public view returns (uint256 count, uint256 countUnique) {
      uint256 totalCount = 0;
      uint256 totalCountUnique = 0;

      for (uint256 i = 0; i < chainIds.length; i++) {
        totalCount += chainCount[chainIds[i]];
        totalCountUnique += chainCountUnique[chainIds[i]];
      }
      
      return (totalCount, totalCountUnique);
    }
}