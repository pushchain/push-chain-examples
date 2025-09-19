# Universal Counter

A demonstration of cross-chain interaction using PushChain's Universal Ethereum Account (UEA) system. This project showcases how users from different blockchains (Ethereum, Solana, and PushChain) can interact with the same application seamlessly.

## Overview

The Universal Counter is a full-stack application that:

1. Identifies users' origin chains (Ethereum, Solana, or PushChain)
2. Maintains separate counters for each blockchain
3. Provides real-time visual feedback through an interactive physics simulation
4. Demonstrates the power of PushChain's cross-chain capabilities

## Project Structure

This project consists of two main components:

- **`app/`**: A React frontend application with Matter.js physics simulation
- **`contracts/`**: Solidity smart contracts that power the Universal Counter

## Features

- **Cross-Chain User Identification**: Automatically detects whether a user is from Ethereum, Solana, or PushChain
- **Universal Ethereum Accounts (UEAs)**: Leverages PushChain's UEA system to identify users' origin chains
- **Interactive Physics Simulation**: Watch blockchain-colored balls drop as counters increment
- **Real-Time Updates**: WebSocket integration for instant counter updates

## Getting Started

### Smart Contracts

Navigate to the `contracts/` directory and follow the instructions in its README to:

- Build and test the smart contracts
- Deploy them to PushChain

### Frontend Application

Navigate to the `app/` directory and follow the instructions in its README to:

- Install dependencies
- Configure the application to connect to your deployed contracts
- Start the development server

## Technical Details

- **Smart Contracts**: Written in Solidity 0.8.22, using PushChain's UEA system
- **Frontend**: React with TypeScript, using Matter.js for physics simulation
- **Blockchain Integration**: ethers.js and PushChain SDK

## Learn More

This example demonstrates several key concepts in PushChain development:

1. **Universal Ethereum Accounts (UEAs)**: How to identify and work with users from different blockchains
2. **Cross-Chain Interaction**: How to create applications that seamlessly work across multiple blockchains
3. **Event Handling**: How to listen for and respond to blockchain events in real-time
4. **Interactive UI**: How to provide engaging visual feedback for blockchain interactions
