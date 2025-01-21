import { Address } from "../address";
import { ESDT_CONTRACT_ADDRESS_HEX, METACHAIN_ID } from "../constants";
import { ErrContractQuery, ErrNetworkProvider } from "../errors";
import { SmartContractQuery, SmartContractQueryResponse } from "../smartContractQuery";
import { Token } from "../tokens";
import { Transaction } from "../transaction";
import { prepareTransactionForBroadcasting, TransactionOnNetwork } from "../transactionOnNetwork";
import { TransactionStatus } from "../transactionStatus";
import { TransactionWatcher } from "../transactionWatcher";
import { getAxios } from "../utils";
import { AccountOnNetwork, GuardianData } from "./accounts";
import { defaultAxiosConfig } from "./config";
import { BaseUserAgent } from "./constants";
import { ContractQueryRequest } from "./contractQueryRequest";
import { INetworkProvider } from "./interface";
import { NetworkConfig } from "./networkConfig";
import { NetworkProviderConfig } from "./networkProviderConfig";
import { NetworkStatus } from "./networkStatus";
import {
    AccountStorage,
    AccountStorageEntry,
    AwaitingOptions,
    BlockOnNetwork,
    TokenAmountOnNetwork,
    TransactionCostResponse,
} from "./resources";
import { DefinitionOfFungibleTokenOnNetwork, DefinitionOfTokenCollectionOnNetwork } from "./tokenDefinitions";
import { extendUserAgentIfBackend } from "./userAgent";

// TODO: Find & remove duplicate code between "ProxyNetworkProvider" and "ApiNetworkProvider".
export class ProxyNetworkProvider implements INetworkProvider {
    private url: string;
    private config: NetworkProviderConfig;
    private userAgentPrefix = `${BaseUserAgent}/proxy`;
    private axios: any;

    constructor(url: string, config?: NetworkProviderConfig) {
        this.url = url;
        this.config = { ...defaultAxiosConfig, ...config };
        this.axios = getAxios();
        extendUserAgentIfBackend(this.userAgentPrefix, this.config);
    }

    async getNetworkConfig(): Promise<NetworkConfig> {
        const response = await this.doGetGeneric("network/config");
        const networkConfig = NetworkConfig.fromHttpResponse(response.config);
        return networkConfig;
    }

    async getNetworkStatus(shard: number = METACHAIN_ID): Promise<NetworkStatus> {
        const response = await this.doGetGeneric(`network/status/${shard}`);
        const networkStatus = NetworkStatus.fromHttpResponse(response.status);
        return networkStatus;
    }

    async getBlock(args: { shard: number; blockHash?: string; blockNonce?: bigint }): Promise<BlockOnNetwork> {
        let response;
        if (args.blockHash) {
            response = await this.doGetGeneric(`block/${args.shard}/by-hash/${args.blockHash}`);
        } else if (args.blockNonce) {
            response = await this.doGetGeneric(`block/${args.shard}/by-nonce/${args.blockNonce}`);
        } else throw new Error("Block hash or block nonce not provided.");
        return BlockOnNetwork.fromHttpResponse(response.block);
    }

    async getLatestBlock(shard: number = METACHAIN_ID): Promise<BlockOnNetwork> {
        const blockNonce = (await this.getNetworkStatus(shard)).blockNonce;
        const response = await this.doGetGeneric(`block/${shard}/by-nonce/${blockNonce}`);
        return BlockOnNetwork.fromHttpResponse(response);
    }

    async getAccount(address: Address): Promise<AccountOnNetwork> {
        const response = await this.doGetGeneric(`address/${address.toBech32()}`);
        const account = AccountOnNetwork.fromProxyHttpResponse(response.account);
        return account;
    }

    async getGuardianData(address: Address): Promise<GuardianData> {
        const response = await this.doGetGeneric(`address/${address.toBech32()}/guardian-data`);
        const accountGuardian = GuardianData.fromHttpResponse(response.guardianData);
        return accountGuardian;
    }

    async getAccountStorage(address: Address): Promise<AccountStorage> {
        const response = await this.doGetGeneric(`address/${address.toBech32()}/keys`);
        const account = AccountStorage.fromHttpResponse(response);
        return account;
    }

    async getAccountStorageEntry(address: Address, entryKey: string): Promise<AccountStorageEntry> {
        const keyAsHex = Buffer.from(entryKey).toString("hex");
        const response = await this.doGetGeneric(`address/${address.toBech32()}/key/${keyAsHex}`);
        const account = AccountStorageEntry.fromHttpResponse(response, entryKey);
        return account;
    }

    awaitAccountOnCondition(
        _address: Address,
        _condition: (account: AccountOnNetwork) => boolean,
        options?: AwaitingOptions,
    ): AccountOnNetwork {
        if (!options) {
            options = new AwaitingOptions();
        }
        throw new Error("Method not implemented.");
    }

    async sendTransaction(tx: Transaction): Promise<string> {
        const transaction = prepareTransactionForBroadcasting(tx);
        const response = await this.doPostGeneric("transaction/send", transaction);
        return response.txHash;
    }

    async simulateTransaction(tx: Transaction, checkSignature: boolean = false): Promise<any> {
        const transaction = prepareTransactionForBroadcasting(tx);
        let url = "transaction/simulate?checkSignature=false";
        if (checkSignature) {
            url = "transaction/simulate";
        }
        const response = await this.doPostGeneric(url, transaction);
        return TransactionOnNetwork.fromSimulateResponse(transaction, response["result"] ?? {});
    }

    async estimateTransactionCost(tx: Transaction): Promise<TransactionCostResponse> {
        const transaction = prepareTransactionForBroadcasting(tx);
        const response = await this.doPostGeneric("transaction/cost", transaction);
        return TransactionCostResponse.fromHttpResponse(response);
    }

    async sendTransactions(txs: Transaction[]): Promise<[number, string[]]> {
        const data = txs.map((tx) => prepareTransactionForBroadcasting(tx));

        const response = await this.doPostGeneric("transaction/send-multiple", data);
        const numSent = Number(response["numOfSentTxs"] ?? 0);
        const hashes = Array(txs.length).fill(null);

        for (let i = 0; i < txs.length; i++) {
            hashes[i] = response.txsHashes[i.toString()] || null;
        }
        return [numSent, hashes];
    }

    async getTransaction(txHash: string): Promise<TransactionOnNetwork> {
        const url = this.buildUrlWithQueryParameters(`transaction/${txHash}`, { withResults: "true" });
        const [data, status] = await Promise.all([this.doGetGeneric(url), this.getTransactionStatus(txHash)]);
        return TransactionOnNetwork.fromProxyHttpResponse(txHash, data.transaction, status);
    }

    async awaitTransactionOnCondition(
        transactionHash: string,
        condition: (account: TransactionOnNetwork) => boolean,
        options?: AwaitingOptions,
    ): Promise<TransactionOnNetwork> {
        if (!options) {
            options = new AwaitingOptions();
        }

        const awaiter = new TransactionWatcher(this, {
            patienceMilliseconds: options.patienceInMilliseconds,
            pollingIntervalMilliseconds: options.pollingIntervalInMilliseconds,
            timeoutMilliseconds: options.timeoutInMilliseconds,
        });
        return await awaiter.awaitOnCondition(transactionHash, condition);
    }

    async awaitTransactionCompleted(transactionHash: string, options?: AwaitingOptions): Promise<TransactionOnNetwork> {
        if (!options) {
            options = new AwaitingOptions();
        }

        const awaiter = new TransactionWatcher(this, {
            patienceMilliseconds: options.patienceInMilliseconds,
            pollingIntervalMilliseconds: options.pollingIntervalInMilliseconds,
            timeoutMilliseconds: options.timeoutInMilliseconds,
        });
        return await awaiter.awaitCompleted(transactionHash);
    }

    async getTokenOfAccount(address: Address, token: Token): Promise<TokenAmountOnNetwork> {
        let response;
        if (token.nonce === 0n) {
            response = await this.doGetGeneric(`address/${address.toBech32()}/esdt/${token.identifier}`);
        } else {
            response = await this.doGetGeneric(
                `address/${address.toBech32()}/nft/${token.identifier}/nonce/${token.nonce}`,
            );
        }
        return TokenAmountOnNetwork.fromProxyResponse(response["tokenData"]);
    }

    async getFungibleTokensOfAccount(address: Address): Promise<TokenAmountOnNetwork[]> {
        const url = `address/${address.toBech32()}/esdt`;
        const response = await this.doGetGeneric(url);
        const responseItems: any[] = Object.values(response.esdts);
        // Skip NFTs / SFTs.
        const responseItemsFiltered = responseItems.filter((item) => !item.nonce);
        const tokens = responseItemsFiltered.map((item) => TokenAmountOnNetwork.fromProxyResponse(item));

        return tokens;
    }

    async getNonFungibleTokensOfAccount(address: Address): Promise<TokenAmountOnNetwork[]> {
        const url = `address/${address.toBech32()}/esdt`;
        const response = await this.doGetGeneric(url);
        const responseItems: any[] = Object.values(response.esdts);
        // Skip fungible tokens.
        const responseItemsFiltered = responseItems.filter((item) => item.nonce >= 0);
        const tokens = responseItemsFiltered.map((item) => TokenAmountOnNetwork.fromProxyResponse(item));

        return tokens;
    }

    async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
        const response = await this.doGetGeneric(`transaction/${txHash}/process-status`);
        const status = new TransactionStatus(response.status);
        return status;
    }

    async getDefinitionOfFungibleToken(tokenIdentifier: string): Promise<DefinitionOfFungibleTokenOnNetwork> {
        const properties = await this.getTokenProperties(tokenIdentifier);
        const definition = DefinitionOfFungibleTokenOnNetwork.fromResponseOfGetTokenProperties(
            tokenIdentifier,
            properties,
        );
        return definition;
    }

    async queryContract(query: SmartContractQuery): Promise<SmartContractQueryResponse> {
        try {
            const request = new ContractQueryRequest(query).toHttpRequest();
            const response = await this.doPostGeneric("vm-values/query", request);
            return SmartContractQueryResponse.fromHttpResponse(response.data, query.function);
        } catch (error: any) {
            throw new ErrContractQuery(error);
        }
    }

    private async getTokenProperties(identifier: string): Promise<Buffer[]> {
        const encodedIdentifier = Buffer.from(identifier);

        const queryResponse = await this.queryContract({
            contract: Address.newFromHex(ESDT_CONTRACT_ADDRESS_HEX),
            function: "getTokenProperties",
            arguments: [new Uint8Array(encodedIdentifier)],
        });

        const properties = queryResponse.returnDataParts;
        return properties?.map((prop) => Buffer.from(prop));
    }

    async getDefinitionOfTokenCollection(collection: string): Promise<DefinitionOfTokenCollectionOnNetwork> {
        const properties = await this.getTokenProperties(collection);
        const definition = DefinitionOfTokenCollectionOnNetwork.fromResponseOfGetTokenProperties(
            collection,
            properties,
        );
        return definition;
    }

    async doGetGeneric(resourceUrl: string): Promise<any> {
        const response = await this.doGet(resourceUrl);
        return response;
    }

    async doPostGeneric(resourceUrl: string, payload: any): Promise<any> {
        const response = await this.doPost(resourceUrl, payload);
        return response;
    }

    private async doGet(resourceUrl: string): Promise<any> {
        const url = `${this.url}/${resourceUrl}`;

        try {
            const response = await this.axios.default.get(url, this.config);
            const payload = response.data.data;
            return payload;
        } catch (error) {
            this.handleApiError(error, resourceUrl);
        }
    }

    private async doPost(resourceUrl: string, payload: any): Promise<any> {
        const url = `${this.url}/${resourceUrl}`;

        try {
            const response = await this.axios.default.post(url, payload, {
                ...this.config,
                headers: {
                    "Content-Type": "application/json",
                    ...this.config.headers,
                },
            });
            const responsePayload = response.data.data;
            return responsePayload;
        } catch (error) {
            this.handleApiError(error, resourceUrl);
        }
    }

    private buildUrlWithQueryParameters(endpoint: string, params: Record<string, string>): string {
        const searchParams = new URLSearchParams();

        for (let [key, value] of Object.entries(params)) {
            if (value) {
                searchParams.append(key, value);
            }
        }

        return `${endpoint}?${searchParams.toString()}`;
    }

    private handleApiError(error: any, resourceUrl: string) {
        if (!error.response) {
            throw new ErrNetworkProvider(resourceUrl, error.toString(), error);
        }

        const errorData = error.response.data;
        const originalErrorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
        throw new ErrNetworkProvider(resourceUrl, originalErrorMessage, error);
    }
}
