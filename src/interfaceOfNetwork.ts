import { Address } from "./address";
import { IAccountBalance, IAddress } from "./interface";

export interface IAccountOnNetwork {
    nonce: number;
    balance: IAccountBalance;
}

export interface INetworkConfig {
    MinGasLimit: number;
    GasPerDataByte: number;
    GasPriceModifier: number;
    ChainID: string;
}

export interface ITransactionOnNetwork {
    isCompleted?: boolean;

    hash: string;
    type: string;
    value: string;
    receiver: IAddress;
    sender: IAddress;
    function?: string;
    data: Buffer;
    status: ITransactionStatus;
    receipt: ITransactionReceipt;
    contractResults: IContractResults;
    logs: ITransactionLogs;
}

export interface ITransactionStatus {
    isPending(): boolean;
    isFailed(): boolean;
    isInvalid(): boolean;
    isExecuted(): boolean;
    isSuccessful(): boolean;
    valueOf(): string;
}

export interface ITransactionReceipt {
    data: string;
}

export interface IContractResults {
    items: IContractResultItem[];
}

export interface IContractResultItem {
    hash: string;
    nonce: number;
    receiver: IAddress;
    sender: IAddress;
    data: string;
    returnMessage: string;
    logs: ITransactionLogs;
    previousHash?: string;
}

export interface IContractQueryResponse {
    returnCode: IContractReturnCode;
    returnMessage: string;
    getReturnDataParts(): Buffer[];
}

export interface IContractReturnCode {
    toString(): string;
}

export interface ITransactionLogs {
    address: Address;
    events: ITransactionEvent[];

    findSingleOrNoneEvent(
        identifier: string,
        predicate?: (event: ITransactionEvent) => boolean,
    ): ITransactionEvent | undefined;
}

export interface ITransactionEvent {
    readonly address: Address;
    readonly identifier: string;
    readonly topics: ITransactionEventTopic[];
    readonly data: string;
    // See https://github.com/multiversx/mx-sdk-js-network-providers/blob/v2.4.0/src/transactionEvents.ts#L13
    readonly dataPayload?: { valueOf(): Uint8Array };
    readonly additionalData?: { valueOf(): Uint8Array }[];

    findFirstOrNoneTopic(predicate: (topic: ITransactionEventTopic) => boolean): ITransactionEventTopic | undefined;
    getLastTopic(): ITransactionEventTopic;
}

export interface ITransactionEventTopic {
    toString(): string;
    hex(): string;
}
