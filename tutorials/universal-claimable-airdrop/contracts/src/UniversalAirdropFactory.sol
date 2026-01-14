// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for $UNICORN token with mint function
interface IUnicornToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract UniversalAirdrop is Ownable, ReentrancyGuard {
    // Hardcoded $UNICORN token address on Push Chain Testnet
    // This is the universal ERC-20 token used for this airdrop example
    IUnicornToken public immutable token = IUnicornToken(0x0165878A594ca255338adfa4d48449f69242Eb8F);
    
    bytes32 public merkleRoot;
    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed account, uint256 amount);
    event MerkleRootUpdated(bytes32 newRoot);

    constructor(
        address _owner,
        uint256 _totalAmount,
        bytes32 _merkleRoot
    ) Ownable(_owner) {
        merkleRoot = _merkleRoot;
        
        // Mint the total airdrop amount of $UNICORN tokens to this contract
        // The _totalAmount should be the sum of all amounts in the merkle tree
        // This ensures the contract has enough tokens for all eligible claims
        token.mint(address(this), _totalAmount);
    }

    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        require(!hasClaimed[msg.sender], "Already claimed");

        // Verify the merkle proof
        // The leaf is created by hashing the claimer's address and their allocated amount
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(msg.sender, amount)))
        );
        require(
            MerkleProof.verify(merkleProof, merkleRoot, leaf),
            "Invalid proof"
        );

        hasClaimed[msg.sender] = true;
        require(token.transfer(msg.sender, amount), "Transfer failed");

        emit Claimed(msg.sender, amount);
    }

    function setMerkleRoot(bytes32 newRoot) external onlyOwner {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    function withdrawTokens(uint256 amount) external onlyOwner {
        require(token.transfer(owner(), amount), "Transfer failed");
    }
}

contract UniversalAirdropFactory {
    event AirdropCreated(
        address indexed airdrop,
        address indexed owner,
        uint256 totalAmount,
        bytes32 merkleRoot
    );

    function createAirdrop(
        uint256 _totalAmount,
        bytes32 _merkleRoot
    ) external returns (address) {
        // Deploy a new UniversalAirdrop contract
        // The constructor will automatically mint _totalAmount of $UNICORN tokens to the airdrop contract
        UniversalAirdrop airdrop = new UniversalAirdrop(
            msg.sender,
            _totalAmount,
            _merkleRoot
        );

        emit AirdropCreated(
            address(airdrop),
            msg.sender,
            _totalAmount,
            _merkleRoot
        );

        return address(airdrop);
    }
}
