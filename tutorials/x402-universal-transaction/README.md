> Reference implementation: [dabit3/a2a-x402-typescript](https://github.com/dabit3/a2a-x402-typescript)
Video overview: [YouTube walkthrough](https://www.youtube.com/watch?v=h75LRiymYX8)

### X402 + Push Chain Universal Transactions

This tutorial builds on the x402 A2A payments example by integrating Push Chain Universal Transactions, enabling customers to pay across different blockchains while merchants retain a consistent, programmable settlement flow.

### What this demonstrates

- **x402 protocol**: Exception-based payment requests and signed payment payloads for Agent-to-Agent commerce.
- **Push Chain’s Universal Transactions**: Chain-agnostic payment execution that lets users pay using assets across supported EVM and non-EVM networks.

### What we added

- Integrated Push Chain to the example to support Universal Transactions.
- Demonstrated how Universal Transactions combine with the x402 flow so customers can authorize and settle payments from different EVM and non-EVM chains without changing the core merchant logic.

### Why it matters

- **Better UX**: Users are not locked to a single chain or asset source.
- **Programmable settlement**: Merchants can define settlement rules while keeping a simple payment interface.

### Credits

We built this tutorial on top of the reference implementation by Nader Dabit:

- **Repository**: [dabit3/a2a-x402-typescript](https://github.com/dabit3/a2a-x402-typescript)
- **Video overview**: [YouTube walkthrough](https://www.youtube.com/watch?v=h75LRiymYX8)
