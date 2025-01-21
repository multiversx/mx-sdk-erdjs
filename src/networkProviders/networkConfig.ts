/**
 * An object holding Network configuration parameters.
 */
export class NetworkConfig {
    raw: Record<string, any> = {};
    /**
     * The chain ID. E.g. "1" for the Mainnet.
     */
    public chainID: string;

    /**
     * The gas required by the Network to process a byte of the transaction data.
     */
    public gasPerDataByte: bigint;

    public gasPriceModifier: number;

    /**
     * The minimum gas limit required to be set when broadcasting a transaction.
     */
    public minGasLimit: bigint;

    /**
     * The minimum gas price required to be set when broadcasting a transaction.
     */
    public minGasPrice: bigint;

    /**
     * The extra gas needed for guarded transactions.
     */
    public extraGasLimitForGuardedTransactions: bigint;

    /**
     * The number of shards.
     */
    public numShards: number;

    /**
     * The round duration.
     */
    public roundDuration: number;
    /**
     * The number of rounds per epoch.
     */
    public numRoundsPerEpoch: number;

    /**
     * The genesis timestamp
     */
    public genesisTimestamp: number;

    constructor() {
        this.chainID = "";
        this.gasPerDataByte = 0n;
        this.genesisTimestamp = 0;
        this.roundDuration = 0;
        this.numRoundsPerEpoch = 0;
        this.minGasLimit = 0n;
        this.minGasPrice = 0n;
        this.extraGasLimitForGuardedTransactions = 0n;
        this.gasPriceModifier = 1;
        this.numShards = 0;
    }

    /**
     * Constructs a configuration object from a HTTP response (as returned by the provider).
     */
    static fromHttpResponse(payload: any): NetworkConfig {
        let networkConfig = new NetworkConfig();

        networkConfig.raw = payload;
        networkConfig.chainID = String(payload["erd_chain_id"]);
        networkConfig.gasPerDataByte = BigInt(payload["erd_gas_per_data_byte"]);
        networkConfig.gasPriceModifier = Number(payload["erd_top_up_factor"]);
        networkConfig.minGasLimit = BigInt(payload["erd_min_gas_limit"]);
        networkConfig.minGasPrice = BigInt(payload["erd_min_gas_price"]);
        networkConfig.extraGasLimitForGuardedTransactions = BigInt(payload["erd_extra_gas_limit_guarded_tx"]);
        networkConfig.numShards = Number(payload["erd_num_shards_without_meta"]);
        networkConfig.roundDuration = Number(payload["erd_round_duration"]);
        networkConfig.numRoundsPerEpoch = Number(payload["erd_rounds_per_epoch"]);
        networkConfig.genesisTimestamp = Number(payload["erd_start_time"]);

        return networkConfig;
    }
}
