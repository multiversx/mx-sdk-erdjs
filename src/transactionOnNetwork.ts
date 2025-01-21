import { Address } from "./address";
import { Transaction } from "./transaction";
import { TransactionLogs } from "./transactionLogs";
import { SmartContractResult } from "./transactionsOutcomeParsers";
import { TransactionStatus } from "./transactionStatus";

export function prepareTransactionForBroadcasting(transaction: Transaction): any {
    return {
        nonce: Number(transaction.nonce),
        value: transaction.value.toString(),
        receiver: transaction.receiver.toBech32(),
        sender: transaction.sender.toBech32(),
        senderUsername: transaction.senderUsername
            ? Buffer.from(transaction.senderUsername).toString("base64")
            : undefined,
        receiverUsername: transaction.receiverUsername
            ? Buffer.from(transaction.receiverUsername).toString("base64")
            : undefined,
        gasPrice: Number(transaction.gasPrice),
        gasLimit: Number(transaction.gasLimit),
        data: transaction.data.length === 0 ? undefined : Buffer.from(transaction.data).toString("base64"),
        chainID: transaction.chainID,
        version: transaction.version,
        options: transaction.options,
        guardian: transaction.guardian.isEmpty() ? undefined : transaction.guardian.toBech32(),
        signature: Buffer.from(transaction.signature).toString("hex"),
        guardianSignature:
            transaction.guardianSignature.length === 0
                ? undefined
                : Buffer.from(transaction.guardianSignature).toString("hex"),
    };
}

export class TransactionOnNetwork {
    raw: Record<string, any> = {};
    isCompleted?: boolean;
    hash: string = "";
    type: string = "";
    nonce: bigint = 0n;
    round: bigint = 0n;
    epoch: number = 0;
    value: bigint = 0n;
    receiver: Address = Address.empty();
    sender: Address = Address.empty();
    senderShard: number = 0;
    receiverShard: number = 0;
    gasLimit: bigint = 0n;
    gasPrice: bigint = 0n;
    function: string = "";
    data: Buffer = Buffer.from([]);
    version: number = 0;
    options: number = 0;
    signature: Uint8Array = new Uint8Array();
    status: TransactionStatus = TransactionStatus.createUnknown();
    timestamp: number = 0;
    miniblockHash: string = "";
    blockHash: string = "";

    smartContractResults: SmartContractResult[] = [];
    logs: TransactionLogs = new TransactionLogs();

    constructor(init?: Partial<TransactionOnNetwork>) {
        Object.assign(this, init);
    }

    static fromProxyHttpResponse(
        txHash: string,
        response: any,
        processStatus?: TransactionStatus | undefined,
    ): TransactionOnNetwork {
        const result = TransactionOnNetwork.fromHttpResponse(txHash, response);
        result.smartContractResults =
            response.smartContractResults?.map(
                (result: Partial<SmartContractResult>) =>
                    new SmartContractResult({
                        ...result,
                        receiver: result.receiver ? new Address(result.receiver) : undefined,
                        sender: result.sender ? new Address(result.sender) : undefined,
                        raw: result,
                    }),
            ) ?? [];

        if (processStatus) {
            result.status = processStatus;
            result.isCompleted = result.status.isSuccessful() || result.status.isFailed();
        }

        return result;
    }

    static fromSimulateResponse(originalTx: Transaction, response: any): TransactionOnNetwork {
        const status = new TransactionStatus(response["status"]);
        const txHash = response["hash"] ?? "";
        const scResults: SmartContractResult[] = [];
        const results = response["scResults"] || {};
        for (const hash in results) {
            const result = results[hash];

            const scResult = new SmartContractResult({
                ...result,
                receiver: result.receiver ? new Address(result.receiver) : undefined,
                sender: result.sender ? new Address(result.sender) : undefined,
                raw: result,
            });
            scResults.push(scResult);
        }

        let result = new TransactionOnNetwork();
        result.hash = txHash;
        result.type = response.type || "";
        result.nonce = BigInt(originalTx.nonce || 0);
        result.round = -1n;
        result.epoch = -1;
        result.value = BigInt((originalTx.value || 0).toString());
        result.sender = new Address(originalTx.sender);
        result.receiver = new Address(originalTx.receiver);
        result.gasPrice = BigInt(originalTx.gasPrice) || 0n;
        result.gasLimit = BigInt(originalTx.gasLimit) || 0n;
        result.function = "";
        result.data = originalTx.data ? Buffer.from(originalTx.data?.toString()) : Buffer.from("");
        result.version = originalTx.version || 1;
        result.options = originalTx.options || 0;
        result.timestamp = 0;
        result.miniblockHash = "";
        result.blockHash = "";
        result.logs = TransactionLogs.fromHttpResponse(response.logs || {});
        result.raw = response;
        result.smartContractResults = scResults;

        result.status = status;
        result.isCompleted = status.isSuccessful() || status.isFailed();

        return result;
    }

    static fromApiHttpResponse(txHash: string, response: any): TransactionOnNetwork {
        const result = TransactionOnNetwork.fromHttpResponse(txHash, response);
        result.smartContractResults =
            response.results?.map(
                (result: Partial<SmartContractResult>) =>
                    new SmartContractResult({
                        ...result,
                        receiver: result.receiver ? new Address(result.receiver) : undefined,
                        sender: result.sender ? new Address(result.sender) : undefined,
                        raw: result,
                    }),
            ) ?? [];
        result.isCompleted = !result.status.isPending();
        return result;
    }

    private static fromHttpResponse(txHash: string, response: any): TransactionOnNetwork {
        let result = new TransactionOnNetwork();
        result.hash = txHash;
        result.type = response.type || "";
        result.nonce = BigInt(response.nonce || 0);
        result.round = BigInt(response.round || 0);
        result.epoch = response.epoch || 0;
        result.value = BigInt((response.value || 0).toString());
        result.sender = new Address(response.sender);
        result.receiver = new Address(response.receiver);
        result.gasPrice = BigInt(response.gasPrice) || 0n;
        result.gasLimit = BigInt(response.gasLimit) || 0n;
        result.function = response.function || "";
        result.data = Buffer.from(response.data || "", "base64");
        result.version = response.version || 1;
        result.options = response.options || 0;
        result.data = Buffer.from(response.data || "", "base64");
        result.status = new TransactionStatus(response.status);
        result.timestamp = response.timestamp || 0;
        result.miniblockHash = response.miniblockHash || "";
        result.blockHash = response.blockHash || "";
        result.logs = TransactionLogs.fromHttpResponse(response.logs || {});
        result.raw = response;

        return result;
    }

    getDateTime(): Date {
        return new Date(this.timestamp * 1000);
    }
}
