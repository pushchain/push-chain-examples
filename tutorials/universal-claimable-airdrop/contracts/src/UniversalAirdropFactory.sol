// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./UniversalAirdrop.sol";
// Commented out as we are using the hardcoded $UNICORN token deployed on Push Chain Testnet at 0x0165878A594ca255338adfa4d48449f69242Eb8F
// import "./Token.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUnicornToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract UniversalAirdropFactory {
    // Using the hardcoded $UNICORN token deployed on Push Chain Testnet at 0x0165878A594ca255338adfa4d48449f69242Eb8F
    IUnicornToken public immutable token = IUnicornToken(0x0165878A594ca255338adfa4d48449f69242Eb8F);
    
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
        // Deploy new Token contract
        // Commented out as we are using the hardcoded $UNICORN token deployed on Push Chain Testnet at 0x0165878A594ca255338adfa4d48449f69242Eb8F
        // Token token = new Token("Unicorn Token", "UNICORN");
        
        // Deploy a new UniversalAirdrop contract first
        UniversalAirdrop airdrop = new UniversalAirdrop(
            address(token),
            _merkleRoot,
            msg.sender
        );

        // Mint the total airdrop amount of $UNICORN tokens directly to the airdrop contract
        // The _totalAmount should be the sum of all amounts in the merkle tree
        // This ensures the airdrop contract has enough tokens for all eligible claims
        token.mint(address(airdrop), _totalAmount);

        emit AirdropCreated(
            address(airdrop),
            msg.sender,
            _totalAmount,
            _merkleRoot
        );

        return address(airdrop);
    }
}

