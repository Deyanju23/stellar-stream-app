import {
  Account,
  Contract,
  Transaction,
  TransactionBuilder,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';
import {
  ClientConfig,
  CreateStreamParams,
  Stream,
  WithdrawParams,
} from './types.js';
import {
  addressToScVal,
  boolToScVal,
  i128ToScVal,
  parseStreamScVal,
  u64ToScVal,
} from './xdr.js';

// Dummy public key for read-only simulations
const DUMMY_SOURCE_ACCOUNT =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';

export class StellarStreamClient {
  public readonly server: rpc.Server;
  public readonly contract: Contract;
  public readonly config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith('http://'),
    });
    this.contract = new Contract(config.contractId);
  }

  /**
   * Builds and prepares an unsigned transaction to create a continuous stream.
   * Transfers deposit_amount from sender into the stream contract.
   */
  async createStreamTx(params: CreateStreamParams): Promise<Transaction> {
    const account = await this.server.getAccount(params.sender);

    const operation = this.contract.call(
      'create_stream',
      addressToScVal(params.sender),
      addressToScVal(params.recipient),
      addressToScVal(params.token),
      i128ToScVal(params.depositAmount),
      u64ToScVal(params.startTime),
      u64ToScVal(params.stopTime),
      boolToScVal(params.cancelable),
    );

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    return prepared as Transaction;
  }

  /**
   * Builds and prepares an unsigned transaction for the recipient to withdraw accrued funds.
   */
  async withdrawTx(params: WithdrawParams): Promise<Transaction> {
    const account = await this.server.getAccount(params.recipient);

    const operation = this.contract.call(
      'withdraw',
      u64ToScVal(params.streamId),
      i128ToScVal(params.amount),
    );

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    return prepared as Transaction;
  }

  /**
   * Builds and prepares an unsigned transaction for the sender to cancel a cancelable stream.
   */
  async cancelTx(streamId: bigint, sender: string): Promise<Transaction> {
    const account = await this.server.getAccount(sender);

    const operation = this.contract.call(
      'cancel',
      u64ToScVal(streamId),
    );

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    return prepared as Transaction;
  }

  /**
   * Queries the stream record by simulating get_stream(stream_id).
   */
  async getStream(streamId: bigint): Promise<Stream> {
    const dummyAccount = new Account(DUMMY_SOURCE_ACCOUNT, '0');

    const tx = new TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call('get_stream', u64ToScVal(streamId)))
      .setTimeout(300)
      .build();

    const sim = await this.server.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(sim)) {
      const errorMsg =
        'error' in sim ? String(sim.error) : 'Simulation returned failure';
      throw new Error(`Failed to simulate get_stream: ${errorMsg}`);
    }

    if (!sim.result?.retval) {
      throw new Error(`get_stream returned empty result for stream ID ${streamId}`);
    }

    return parseStreamScVal(sim.result.retval);
  }

  /**
   * Queries the on-chain calculated balance for target address on a given stream.
   */
  async balanceOf(streamId: bigint, target: string): Promise<bigint> {
    const dummyAccount = new Account(DUMMY_SOURCE_ACCOUNT, '0');

    const tx = new TransactionBuilder(dummyAccount, {
      fee: '100',
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        this.contract.call(
          'balance_of',
          u64ToScVal(streamId),
          addressToScVal(target),
        ),
      )
      .setTimeout(300)
      .build();

    const sim = await this.server.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(sim)) {
      const errorMsg =
        'error' in sim ? String(sim.error) : 'Simulation returned failure';
      throw new Error(`Failed to simulate balance_of: ${errorMsg}`);
    }

    if (!sim.result?.retval) {
      throw new Error(`balance_of returned empty result for stream ID ${streamId}`);
    }

    const native = scValToNative(sim.result.retval);
    return BigInt(native);
  }
}
