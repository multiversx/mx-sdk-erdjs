import { IAccount } from "../accounts/interfaces";
import { ProviderWrapper } from "../entrypoints/providerWrapper";
import { ITransactionOnNetwork } from "../interfaceOfNetwork";
import { INetworkProvider } from "../networkProviders/interface";
import { Transaction } from "../transaction";
import { TransactionComputer } from "../transactionComputer";
import { TransactionsFactoryConfig } from "../transactionsFactoryConfig";
import { DelegationTransactionsOutcomeParser } from "../transactionsOutcomeParsers";
import { TransactionWatcher } from "../transactionWatcher";
import { DelegationTransactionsFactory } from "./delegationTransactionsFactory";
import * as inputs from "./resources";

export class DelegationController {
    private transactionAwaiter: TransactionWatcher;
    private factory: DelegationTransactionsFactory;
    private parser: DelegationTransactionsOutcomeParser;
    private txComputer: TransactionComputer;

    constructor(options: { chainID: string; networkProvider: INetworkProvider }) {
        this.transactionAwaiter = new TransactionWatcher(new ProviderWrapper(options.networkProvider));
        this.factory = new DelegationTransactionsFactory({
            config: new TransactionsFactoryConfig({ chainID: options.chainID }),
        });
        this.parser = new DelegationTransactionsOutcomeParser();
        this.txComputer = new TransactionComputer();
    }

    async createTransactionForNewDelegationContract(
        sender: IAccount,
        nonce: bigint,
        options: inputs.NewDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForNewDelegationContract(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async awaitCompletedCreateNewDelegationContract(txHash: string): Promise<{ contractAddress: string }[]> {
        const transaction = await this.transactionAwaiter.awaitCompleted(txHash);
        return this.parseCreateNewDelegationContract(transaction);
    }

    parseCreateNewDelegationContract(transactionOnNetwork: ITransactionOnNetwork): { contractAddress: string }[] {
        return this.parser.parseCreateNewDelegationContract(transactionOnNetwork);
    }

    async createTransactionForAddingNodes(
        sender: IAccount,
        nonce: bigint,
        options: inputs.AddNodesInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForAddingNodes(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForRemovingNodes(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageNodesInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForRemovingNodes(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForStakingNodes(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageNodesInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForStakingNodes(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForUnbondingNodes(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageNodesInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForUnbondingNodes(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForUnstakingNodes(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageNodesInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForUnstakingNodes(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForUnjailingNodes(
        sender: IAccount,
        nonce: bigint,
        options: inputs.UnjailingNodesInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForUnjailingNodes(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForChangingServiceFee(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ChangeServiceFee,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForChangingServiceFee(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForModifyingDelegationCap(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ModifyDelegationCapInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForModifyingDelegationCap(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForSettingAutomaticActivation(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForSettingAutomaticActivation(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForUnsettingAutomaticActivation(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForUnsettingAutomaticActivation(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForSettingCapCheckOnRedelegateRewards(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForSettingCapCheckOnRedelegateRewards(
            sender.address,
            options,
        );

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForUnsettingCapCheckOnRedelegateRewards(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForUnsettingCapCheckOnRedelegateRewards(
            sender.address,
            options,
        );

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForSettingMetadata(
        sender: IAccount,
        nonce: bigint,
        options: inputs.SetContractMetadataInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForSettingMetadata(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForDelegating(
        sender: IAccount,
        nonce: bigint,
        options: inputs.DelegateActionsInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForDelegating(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForClaimingRewards(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForClaimingRewards(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForRedelegatingRewards(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForRedelegatingRewards(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForUndelegating(
        sender: IAccount,
        nonce: bigint,
        options: inputs.DelegateActionsInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForUndelegating(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }

    async createTransactionForWithdrawing(
        sender: IAccount,
        nonce: bigint,
        options: inputs.ManageDelegationContractInput,
    ): Promise<Transaction> {
        const transaction = this.factory.createTransactionForWithdrawing(sender.address, options);

        transaction.nonce = nonce;
        transaction.signature = await sender.sign(this.txComputer.computeBytesForSigning(transaction));

        return transaction;
    }
}
