// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Full Documentation:
//   https://push.org/docs/chain/build/contract-initiated-multichain-execution
//
// PushOutboundWithFunds
// =====================
// Push Chain contract that dispatches an outbound to BNB Testnet AND bridges
// PRC-20 tokens (e.g. pBnb) to the destination CEA in the SAME outbound. The
// CEA on BNB receives the bridged native tokens and executes the multicall.
// This is the "deposit-and-execute" pattern from Push to external chains.
//
// Differs from `contract-initiated-outbound-execution`:
//   - That example sets `amount = 0` (payload-only).
//   - This one sets `amount > 0` + `token = pPRC20`. UGPC pulls the PRC-20
//     from this contract via `transferFrom`, so the contract MUST hold an
//     approval for UGPC and a balance of the PRC-20 first.

interface IPRC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

struct UniversalOutboundTxRequest {
    bytes recipient;
    address token;
    uint256 amount;
    uint256 gasLimit;
    bytes payload;
    address revertRecipient;
}

interface IUniversalGatewayPC {
    function sendUniversalTxOutbound(UniversalOutboundTxRequest calldata req) external payable;
}

contract PushOutboundWithFunds {
    address public immutable ugpc;

    bytes4 internal constant UEA_MULTICALL_SELECTOR = 0x2cc2842d;

    struct Multicall {
        address to;
        uint256 value;
        bytes data;
    }

    event Funded(address indexed from, uint256 amount, uint256 newBalance);
    event OutboundWithFundsKicked(
        bytes recipient,
        address indexed token,
        uint256 amount,
        bytes payload
    );

    error ZeroAddress();
    error InsufficientPC(uint256 required, uint256 available);
    error InsufficientPRC20(address token, uint256 required, uint256 available);

    constructor(address _ugpc) {
        if (_ugpc == address(0)) revert ZeroAddress();
        ugpc = _ugpc;
    }

    /// @notice Top up the contract with PC for UGPC fees.
    function fund() external payable {
        emit Funded(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Dispatch an outbound that bridges PRC-20 tokens AND executes a
    /// payload on the destination chain. The destination CEA receives `amount`
    /// of the corresponding native token (or wrapped equivalent) and executes
    /// the multicall.
    /// @param destinationCEAAddr This contract's CEA on the destination chain.
    /// @param prc20Token PRC-20 on Push (e.g. pBNB). The CEA gets `amount` of
    ///     the corresponding native asset on the destination chain.
    /// @param amount Amount of `prc20Token` to bridge. The contract must hold
    ///     at least this much; UGPC pulls via `transferFrom`.
    /// @param destinationContract Target contract on the destination chain.
    /// @param destinationCalldata Calldata for the destination contract.
    /// @param destinationCallValue How much native token (out of `amount`)
    ///     to forward to `destinationContract` as msg.value of the inner call.
    /// @param protocolFeePc PC the contract forwards to UGPC for outbound fee.
    function dispatchOutboundWithFunds(
        address destinationCEAAddr,
        address prc20Token,
        uint256 amount,
        address destinationContract,
        bytes calldata destinationCalldata,
        uint256 destinationCallValue,
        uint256 protocolFeePc
    ) external {
        if (destinationCEAAddr == address(0) || prc20Token == address(0) || destinationContract == address(0)) {
            revert ZeroAddress();
        }
        if (address(this).balance < protocolFeePc) {
            revert InsufficientPC(protocolFeePc, address(this).balance);
        }
        uint256 prc20Bal = IPRC20(prc20Token).balanceOf(address(this));
        if (prc20Bal < amount) {
            revert InsufficientPRC20(prc20Token, amount, prc20Bal);
        }

        // Approve UGPC to pull the PRC-20.
        IPRC20(prc20Token).approve(ugpc, amount);

        // Inner multicall: a single call to `destinationContract` with
        // `destinationCallValue` native (out of the bridged amount) as msg.value.
        Multicall[] memory calls = new Multicall[](1);
        calls[0] = Multicall({
            to: destinationContract,
            value: destinationCallValue,
            data: destinationCalldata
        });
        bytes memory payload = abi.encodePacked(
            UEA_MULTICALL_SELECTOR,
            abi.encode(calls)
        );

        // Dispatch via UGPC.
        bytes memory targetBytes = abi.encodePacked(destinationCEAAddr);
        UniversalOutboundTxRequest memory req = UniversalOutboundTxRequest({
            recipient: targetBytes,
            token: prc20Token,
            amount: amount,
            gasLimit: 2_000_000,         // headroom for nested call with value
            payload: payload,
            revertRecipient: address(this)
        });

        IUniversalGatewayPC(ugpc).sendUniversalTxOutbound{value: protocolFeePc}(req);

        emit OutboundWithFundsKicked(targetBytes, prc20Token, amount, payload);
    }

    receive() external payable {}
}
