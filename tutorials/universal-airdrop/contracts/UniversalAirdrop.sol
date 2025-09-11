// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUEAFactory.sol";

/**
 * @title Universal Airdrop Contract for Push Chain
 * @dev Airdrop contract that supports claims from multiple origin chains using UEA (Universal External Accounts)
 * @notice This contract binds claims to the caller's origin chain to prevent cross-chain spoofing
 */
contract UniversalAirdrop is Ownable, ReentrancyGuard {
    // Push Chain UEAFactory address - hardcoded as per specification
    address public constant UEA_FACTORY =
        0x00000000000000000000000000000000000000eA;

    // State variables
    bytes32 public merkleRoot;
    mapping(bytes32 => bool) public claimed; // keyed by claimId to prevent double claims per (address, chainNamespace, chainId)
    IERC20 public immutable token;

    // Push Chain Donut testnet chain ID constant
    string public constant PUSH_CHAIN_ID = "push-donut";

    // Events
    event Claimed(
        address indexed recipient,
        string chainNamespace,
        string chainId,
        uint256 amount
    );
    event MerkleRootUpdated(bytes32 newRoot);

    /**
     * @dev Constructor
     * @param _token The ERC20 token to be airdropped
     * @param _merkleRoot The initial Merkle root for the airdrop
     */
    constructor(IERC20 _token, bytes32 _merkleRoot) Ownable(msg.sender) {
        token = _token;
        merkleRoot = _merkleRoot;
    }

    /**
     * @dev Claim tokens using a Merkle proof
     * @param proof The Merkle proof proving inclusion in the airdrop
     * @param amount The amount of tokens to claim
     * @param chainNamespace The origin chain namespace (e.g., "eip155", "solana", "push")
     * @param chainId The origin chain ID (e.g., "11155111" for Sepolia, "push-donut" for Push)
     * @notice The claim is bound to the caller's origin chain to prevent cross-chain spoofing
     */
    function claim(
        bytes32[] calldata proof,
        uint256 amount,
        string calldata chainNamespace,
        string calldata chainId
    ) external nonReentrant {
        address recipientAddress;
        {
            // Get origin chain information from UEAFactory for verification (scoped to reduce stack usage)
            (UniversalAccountId memory account, bool isUEA) = IUEAFactory(
                UEA_FACTORY
            ).getOriginForUEA(msg.sender);

            if (isUEA) {
                // For UEA accounts, verify the provided chain info matches the origin
                require(
                    keccak256(abi.encodePacked(chainNamespace)) ==
                        keccak256(abi.encodePacked(account.chainNamespace)) &&
                        keccak256(abi.encodePacked(chainId)) ==
                        keccak256(abi.encodePacked(account.chainId)),
                    "Provided chain info does not match UEA origin"
                );
                // Convert owner bytes to address for leaf computation
                // If owner is 20 bytes (EVM), cast directly; otherwise derive address from keccak256(owner)
                if (account.owner.length == 20) {
                    recipientAddress = address(bytes20(account.owner));
                } else {
                    recipientAddress = address(
                        uint160(uint256(keccak256(account.owner)))
                    );
                }
            } else {
                // For non-UEA accounts (could be native Push Chain or direct connections)
                // Allow claiming from any chain - the Merkle proof will verify eligibility
                recipientAddress = msg.sender;
            }
        }

        // Prevent double claims for the same (address, chainNamespace, chainId) tuple
        require(
            !claimed[
                keccak256(
                    abi.encodePacked(recipientAddress, chainNamespace, chainId)
                )
            ],
            "Already claimed for this origin chain"
        );

        // Verify the Merkle proof (compute leaf inline)
        require(
            MerkleProof.verify(
                proof,
                merkleRoot,
                keccak256(
                    abi.encodePacked(
                        recipientAddress,
                        chainNamespace,
                        chainId,
                        amount
                    )
                )
            ),
            "Invalid Merkle proof"
        );

        // Mark as claimed and transfer tokens
        claimed[
            keccak256(
                abi.encodePacked(recipientAddress, chainNamespace, chainId)
            )
        ] = true;
        require(
            token.transfer(recipientAddress, amount),
            "Token transfer failed"
        );

        emit Claimed(recipientAddress, chainNamespace, chainId, amount);
    }

    /**
     * @dev Update the Merkle root (only owner)
     * @param newRoot The new Merkle root
     * @notice This allows updating the airdrop with new recipients
     */
    function setMerkleRoot(bytes32 newRoot) external onlyOwner {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    /**
     * @dev Recover ERC20 tokens (only owner)
     * @param tokenAddress The address of the token to recover
     * @param amount The amount to recover
     * @notice Allows the owner to recover mistakenly sent tokens
     */
    function recoverERC20(
        address tokenAddress,
        uint256 amount
    ) external onlyOwner {
        require(tokenAddress != address(token), "Cannot recover airdrop token");
        IERC20(tokenAddress).transfer(owner(), amount);
    }
}
