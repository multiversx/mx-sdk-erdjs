import { BytesValue } from "../abi";
import { Address } from "../address";
import { Token } from "../tokens";
import { TransactionStatus } from "../transactionStatus";
import {
    DEFAULT_ACCOUNT_AWAITING_PATIENCE_IN_MILLISECONDS,
    DEFAULT_ACCOUNT_AWAITING_POLLING_TIMEOUT_IN_MILLISECONDS,
    DEFAULT_ACCOUNT_AWAITING_TIMEOUT_IN_MILLISECONDS,
} from "./constants";

/**
 * A plain view of an account storage.
 */
export class AccountStorage {
    raw: Record<string, any> = {};
    blockCoordinates!: BlockCoordinates;
    entries: AccountStorageEntry[] = [];
    constructor(init?: Partial<AccountStorage>) {
        Object.assign(this, init);
    }

    static fromHttpResponse(payload: any): AccountStorage {
        let result = new AccountStorage();

        const pairs = payload["pairs"] || {};
        const entries: AccountStorageEntry[] = Object.entries(pairs).map(([key, value]) => {
            const decodedKey = Buffer.from(key, "hex").toString("utf8");
            const val: string = value ? (value as string).toString() : "";
            const decodedValue = Buffer.from(val).toString();

            return new AccountStorageEntry({
                raw: { [key]: value },
                key: decodedKey,
                value: decodedValue,
            });
        });
        result.raw = payload;
        result.entries = entries;
        result.blockCoordinates = BlockCoordinates.fromHttpResponse(payload);

        return result;
    }
}

/**
 * An object holding network status configuration parameters.
 */
export class BlockOnNetwork {
    /**
     * The raw data return by provider.
     */
    public raw: Record<string, any> = {};

    /**
     * The shard number.
     */
    public shard: number = 0;

    /**
     * The shard nonce.
     */
    public nonce: bigint = 0n;

    /**
     * The block hash.
     */
    public hash: string = "";

    /**
     * The block previous hash.
     */
    public previousHash: string = "";

    /**
     * The block timestamp.
     */
    public timestamp: number = 0;

    /**
     * The block timestamp.
     */
    public round: number = 0;

    /**
     * The block timestamp.
     */
    public epoch: number = 0;

    /**
     * Constructs a configuration object from a HTTP response (as returned by the provider).
     */
    static fromHttpResponse(payload: any): BlockOnNetwork {
        let blockOnNetwork = new BlockOnNetwork();

        blockOnNetwork.raw = payload;
        blockOnNetwork.shard = Number(payload["shard"]) ?? 0;
        blockOnNetwork.nonce = BigInt(payload["nonce"] ?? 0);
        blockOnNetwork.hash = payload["hash"] ?? "";
        blockOnNetwork.previousHash = payload["prevBlockHash"] ?? payload["prevHash"] ?? "";
        blockOnNetwork.timestamp = Number(payload["timestamp"] ?? 0);
        blockOnNetwork.round = Number(payload["round"] ?? 0);
        blockOnNetwork.epoch = Number(payload["epoch"] ?? 0);

        return blockOnNetwork;
    }
}

export class BlockCoordinates {
    nonce: bigint = 0n;
    hash: string = "";
    rootHash: string = "";
    constructor(init?: Partial<BlockCoordinates>) {
        Object.assign(this, init);
    }
    static fromHttpResponse(payload: any): BlockCoordinates {
        const result = new BlockCoordinates();
        const value = payload["blockInfo"] || {};

        result.nonce = value["nonce"] || 0n;
        result.hash = value["hash"] || "";
        result.rootHash = value["rootHash"] || "";

        return result;
    }
}

export class AccountStorageEntry {
    raw: Record<string, any> = {};
    address: Address = Address.empty();
    key: string = "";
    value: string = "";

    constructor(init?: Partial<AccountStorageEntry>) {
        Object.assign(this, init);
    }

    static fromHttpResponse(payload: any, key: string): AccountStorageEntry {
        const result = new AccountStorageEntry();
        const value = payload["value"] || "";

        result.raw = payload;
        result.key = key;
        result.value = BytesValue.fromHex(value).toString();

        return result;
    }
}

export class AwaitingOptions {
    pollingIntervalInMilliseconds: number = DEFAULT_ACCOUNT_AWAITING_POLLING_TIMEOUT_IN_MILLISECONDS;
    timeoutInMilliseconds: number = DEFAULT_ACCOUNT_AWAITING_TIMEOUT_IN_MILLISECONDS;
    patienceInMilliseconds: number = DEFAULT_ACCOUNT_AWAITING_PATIENCE_IN_MILLISECONDS;
}

export class TransactionCostResponse {
    raw: Record<string, any> = {};
    gasLimit: number = 0;
    status: TransactionStatus = TransactionStatus.createUnknown();

    static fromHttpResponse(payload: any): TransactionCostResponse {
        const result = new TransactionCostResponse();
        result.raw = payload;
        result.gasLimit = payload["txGasUnits"] ?? 0;
        result.status = new TransactionStatus("");

        return result;
    }
}

export class TokenAmountOnNetwork {
    raw: Record<string, any> = {};
    token: Token = new Token({ identifier: "" });
    amount: bigint = 0n;
    block_coordinates?: BlockCoordinates;

    constructor(init?: Partial<TokenAmountOnNetwork>) {
        Object.assign(this, init);
    }

    static fromProxyResponse(payload: any): TokenAmountOnNetwork {
        const result = new TokenAmountOnNetwork();

        result.raw = payload;
        result.amount = BigInt(payload["balance"] ?? 0);
        result.token = new Token({ identifier: payload["tokenIdentifier"] ?? "", nonce: payload["nonce"] ?? 0 });

        return result;
    }

    static fromApiResponse(payload: any): TokenAmountOnNetwork {
        const result = new TokenAmountOnNetwork();

        result.raw = payload;
        result.amount = BigInt(payload["balance"] ?? 0);
        result.token = new Token({ identifier: payload["identifier"] ?? "", nonce: payload["nonce"] ?? 0 });

        return result;
    }
}
