import { PushUniversalAccountButton, usePushChain, usePushChainClient, usePushWalletContext } from '@pushchain/ui-kit'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import CounterABI from './abi/Counter.json'
import './App.css'

// Contract address for the deployed Counter contract
const COUNTER_CONTRACT_ADDRESS = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853'

// Global provider for Push Chain testnet
const provider = new ethers.JsonRpcProvider(
  "https://evm.rpc-testnet-donut-node1.push.org/"
);

function App() {
  const { universalAccount, connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const { PushChain } = usePushChain();
  const [counter, setCounter] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [txHash, setTxHash] = useState<string>('')

  // Function to encode transaction data for increment function
  const getTxData = () => {
    if (!pushChainClient) return "";

    return PushChain.utils.helpers.encodeTxData({
      abi: CounterABI,
      functionName: "increment",
    });
  };

  // Function to read the current counter value
  const readCounter = async () => {
    try {
      const contract = new ethers.Contract(COUNTER_CONTRACT_ADDRESS, CounterABI, provider)
      
      const currentCount = await contract.countPC()
      setCounter(Number(currentCount))
    } catch (err) {
      console.error('Error reading counter:', err)
      setError('Failed to read counter value')
    }
  }

  // Function to increment the counter
  const incrementCounter = async () => {
    if (connectionStatus === "connected" && pushChainClient) {
      try {
        setIsLoading(true);
        setError('');

        // Send transaction to increment counter
        const tx = await pushChainClient.universal.sendTransaction({
          to: COUNTER_CONTRACT_ADDRESS,
          data: getTxData(),
          value: BigInt(0),
        });

        setTxHash(tx.hash);

        // Wait for transaction to be mined
        await tx.wait();

        // Refresh counter values
        await readCounter();

        setIsLoading(false);
      } catch (err) {
        console.error("Transaction error:", err);
        setError('Failed to increment counter');
        setIsLoading(false);
      }
    } else {
      setError("Please connect your wallet first");
    }
  }

  // Read counter value on component mount and when account changes
  useEffect(() => {
    readCounter()
  }, [])

  // Also read counter when account changes (in case user switches accounts)
  useEffect(() => {
    if (universalAccount) {
      readCounter()
    }
  }, [universalAccount])
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0
    }}>
      <h1 style={{ 
        fontSize: '2.5rem', 
        fontWeight: 'bold', 
        marginBottom: '2rem',
        color: '#333',
        textAlign: 'center'
      }}>
        Simple Counter Example
      </h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <PushUniversalAccountButton />
      </div>
      
      <div style={{ 
        fontSize: '1.5rem', 
        marginBottom: '1rem',
        color: '#333',
        textAlign: 'center'
      }}>
        Counter: {counter}
      </div>
      
      {!universalAccount ? (
        <p style={{ 
          fontSize: '1.1rem', 
          color: '#666',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          Please connect your wallet to interact with the counter
        </p>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={incrementCounter}
            disabled={isLoading}
            style={{
              padding: '12px 24px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: isLoading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            {isLoading ? 'Incrementing...' : 'Increment Counter'}
          </button>
          
          {error && (
            <div style={{ 
              color: '#dc3545',
              fontSize: '0.9rem',
              marginTop: '1rem'
            }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App