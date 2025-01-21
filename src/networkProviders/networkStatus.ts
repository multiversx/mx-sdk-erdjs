/**
 * An object holding network status configuration parameters.
 */
export class NetworkStatus {
    raw: Record<string, any> = {};

    /**
     * The block timestamp.
     */
    public blockTimestamp: number;

    /**
     * The block nonce.
     */
    public blockNonce: bigint;

    /**
     * The highest final nonce.
     */
    public highestFinalNonce: bigint;

    /**
     * The current round.
     */
    public currentRound: bigint;

    /**
     * The current epoch.
     */
    public currentEpoch: number;

    constructor() {
        this.currentRound = 0n;
        this.currentEpoch = 0;
        this.highestFinalNonce = 0n;
        this.blockNonce = 0n;
        this.blockTimestamp = 0;
    }

    /**
     * Constructs a configuration object from a HTTP response (as returned by the provider).
     */
    static fromHttpResponse(payload: any): NetworkStatus {
        let networkStatus = new NetworkStatus();

        networkStatus.raw = payload;
        networkStatus.currentRound = BigInt(payload["erd_current_round"]);
        networkStatus.currentEpoch = Number(payload["erd_epoch_number"]);
        networkStatus.highestFinalNonce = BigInt(payload["erd_highest_final_nonce"]);
        networkStatus.blockNonce = BigInt(payload["erd_nonce"]);
        networkStatus.blockTimestamp = Number(payload["erd_block_timestamp"]);

        return networkStatus;
    }
}
