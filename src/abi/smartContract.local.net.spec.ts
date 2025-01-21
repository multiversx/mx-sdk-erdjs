import { assert } from "chai";
import { promises } from "fs";
import { Logger } from "../logger";
import {
    SmartContractController,
    SmartContractTransactionsFactory,
    SmartContractTransactionsOutcomeParser,
} from "../smartContracts";
import { stringifyBigIntJSON } from "../testutils";
import { createLocalnetProvider } from "../testutils/networkProviders";
import { loadTestWallets, TestWallet } from "../testutils/wallets";
import { TransactionComputer } from "../transactionComputer";
import { TransactionsFactoryConfig } from "../transactionsFactoryConfig";
import { TransactionWatcher } from "../transactionWatcher";
import { decodeUnsignedNumber } from "./codec";
import { SmartContract } from "./smartContract";
import {
    AddressValue,
    BigUIntValue,
    BytesValue,
    OptionalValue,
    OptionValue,
    TokenIdentifierValue,
    U32Value,
} from "./typesystem";

describe("test on local testnet", function () {
    let alice: TestWallet, bob: TestWallet, carol: TestWallet;
    let provider = createLocalnetProvider();
    let watcher: TransactionWatcher;
    let parser: SmartContractTransactionsOutcomeParser;

    before(async function () {
        ({ alice, bob, carol } = await loadTestWallets());

        watcher = new TransactionWatcher({
            getTransaction: async (hash: string) => {
                return await provider.getTransaction(hash);
            },
        });
        parser = new SmartContractTransactionsOutcomeParser();
    });

    it("counter: should deploy, then simulate transactions using SmartContractTransactionsFactory", async function () {
        this.timeout(60000);

        TransactionWatcher.DefaultPollingInterval = 5000;
        TransactionWatcher.DefaultTimeout = 50000;

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        const config = new TransactionsFactoryConfig({ chainID: network.chainID });
        const factory = new SmartContractTransactionsFactory({ config: config });

        const bytecode = await promises.readFile("src/testdata/counter.wasm");

        const deployTransaction = factory.createTransactionForDeploy(alice.address, {
            bytecode: bytecode,
            gasLimit: 4000000n,
        });
        deployTransaction.nonce = BigInt(alice.account.nonce.valueOf());

        const transactionComputer = new TransactionComputer();
        deployTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(deployTransaction)),
        );

        const contractAddress = SmartContract.computeAddress(alice.address, alice.account.nonce);
        alice.account.incrementNonce();

        const smartContractCallTransaction = factory.createTransactionForExecute(alice.address, {
            contract: contractAddress,
            function: "increment",
            gasLimit: 4000000n,
        });
        smartContractCallTransaction.nonce = BigInt(alice.account.nonce.valueOf());
        smartContractCallTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(smartContractCallTransaction)),
        );

        alice.account.incrementNonce();

        const simulateOne = factory.createTransactionForExecute(alice.address, {
            function: "increment",
            contract: contractAddress,
            gasLimit: 200000n,
        });

        simulateOne.nonce = BigInt(alice.account.nonce.valueOf());
        simulateOne.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(simulateOne)),
        );

        alice.account.incrementNonce();

        const simulateTwo = factory.createTransactionForExecute(alice.address, {
            function: "foobar",
            contract: contractAddress,
            gasLimit: 700000n,
        });

        simulateTwo.nonce = BigInt(alice.account.nonce.valueOf());
        simulateTwo.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(simulateTwo)),
        );

        alice.account.incrementNonce();

        // Broadcast & execute
        const deployTxHash = await provider.sendTransaction(deployTransaction);
        const callTxHash = await provider.sendTransaction(smartContractCallTransaction);
        await watcher.awaitCompleted(deployTxHash);
        let transactionOnNetwork = await provider.getTransaction(deployTxHash);
        let response = parser.parseExecute({ transactionOnNetwork });

        assert.isTrue(response.returnCode == "ok");

        await watcher.awaitCompleted(callTxHash);
        transactionOnNetwork = await provider.getTransaction(callTxHash);
        response = parser.parseExecute({ transactionOnNetwork });
        assert.isTrue(response.returnCode == "ok");

        // Simulate
        Logger.trace(stringifyBigIntJSON(await provider.simulateTransaction(simulateOne)));
        Logger.trace(stringifyBigIntJSON(await provider.simulateTransaction(simulateTwo)));
    });

    it("counter: should deploy, call and query contract using SmartContractTransactionsFactory", async function () {
        this.timeout(80000);

        TransactionWatcher.DefaultPollingInterval = 5000;
        TransactionWatcher.DefaultTimeout = 50000;

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        const config = new TransactionsFactoryConfig({ chainID: network.chainID });
        const factory = new SmartContractTransactionsFactory({ config: config });

        const bytecode = await promises.readFile("src/testdata/counter.wasm");

        const deployTransaction = factory.createTransactionForDeploy(alice.address, {
            bytecode: bytecode,
            gasLimit: 3000000n,
        });
        deployTransaction.nonce = BigInt(alice.account.nonce.valueOf());

        const transactionComputer = new TransactionComputer();
        deployTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(deployTransaction)),
        );

        const contractAddress = SmartContract.computeAddress(alice.address, alice.account.nonce);
        alice.account.incrementNonce();

        const firstScCallTransaction = factory.createTransactionForExecute(alice.address, {
            contract: contractAddress,
            function: "increment",
            gasLimit: 3000000n,
        });
        firstScCallTransaction.nonce = BigInt(alice.account.nonce.valueOf());
        firstScCallTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(firstScCallTransaction)),
        );

        alice.account.incrementNonce();

        const secondScCallTransaction = factory.createTransactionForExecute(alice.address, {
            contract: contractAddress,
            function: "increment",
            gasLimit: 3000000n,
        });
        secondScCallTransaction.nonce = BigInt(alice.account.nonce.valueOf());
        secondScCallTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(secondScCallTransaction)),
        );

        alice.account.incrementNonce();

        // Broadcast & execute
        const deployTxHash = await provider.sendTransaction(deployTransaction);
        const firstScCallHash = await provider.sendTransaction(firstScCallTransaction);
        const secondScCallHash = await provider.sendTransaction(secondScCallTransaction);

        await watcher.awaitCompleted(deployTxHash);
        await watcher.awaitCompleted(firstScCallHash);
        await watcher.awaitCompleted(secondScCallHash);

        // Check counter
        const smartContractQueriesController = new SmartContractController({
            chainID: "localnet",
            networkProvider: provider,
        });

        const query = smartContractQueriesController.createQuery({
            contract: contractAddress,
            function: "get",
            arguments: [],
        });

        const queryResponse = await smartContractQueriesController.runQuery(query);
        assert.lengthOf(queryResponse.returnDataParts, 1);
        assert.equal(3, decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])));
    });

    it("erc20: should deploy, call and query contract using SmartContractTransactionsFactory", async function () {
        this.timeout(60000);

        TransactionWatcher.DefaultPollingInterval = 5000;
        TransactionWatcher.DefaultTimeout = 50000;

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        const config = new TransactionsFactoryConfig({ chainID: network.chainID });
        const factory = new SmartContractTransactionsFactory({ config: config });

        const bytecode = await promises.readFile("src/testdata/erc20.wasm");

        const deployTransaction = factory.createTransactionForDeploy(alice.address, {
            bytecode: bytecode,
            gasLimit: 50000000n,
            arguments: [new U32Value(10000)],
        });
        deployTransaction.nonce = BigInt(alice.account.nonce.valueOf());
        const transactionComputer = new TransactionComputer();
        deployTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(deployTransaction)),
        );

        const contractAddress = SmartContract.computeAddress(alice.address, alice.account.nonce);
        alice.account.incrementNonce();

        const transactionMintBob = factory.createTransactionForExecute(alice.address, {
            contract: contractAddress,
            function: "transferToken",
            gasLimit: 9000000n,
            arguments: [new AddressValue(bob.address), new U32Value(1000)],
        });
        transactionMintBob.nonce = BigInt(alice.account.nonce.valueOf());
        transactionMintBob.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(transactionMintBob)),
        );

        alice.account.incrementNonce();

        const transactionMintCarol = factory.createTransactionForExecute(alice.address, {
            contract: contractAddress,
            function: "transferToken",
            gasLimit: 9000000n,
            arguments: [new AddressValue(carol.address), new U32Value(1500)],
        });
        transactionMintCarol.nonce = BigInt(alice.account.nonce.valueOf());
        transactionMintCarol.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(transactionMintCarol)),
        );

        alice.account.incrementNonce();

        // Broadcast & execute
        const deployTxHash = await provider.sendTransaction(deployTransaction);
        const mintBobTxHash = await provider.sendTransaction(transactionMintBob);
        const mintCarolTxHash = await provider.sendTransaction(transactionMintCarol);

        await watcher.awaitCompleted(deployTxHash);
        await watcher.awaitCompleted(mintBobTxHash);
        await watcher.awaitCompleted(mintCarolTxHash);

        // Query state, do some assertions
        const smartContractController = new SmartContractController({
            chainID: "localnet",
            networkProvider: provider,
        });

        let query = smartContractController.createQuery({
            contract: contractAddress,
            function: "totalSupply",
            arguments: [],
        });
        let queryResponse = await smartContractController.runQuery(query);
        assert.lengthOf(queryResponse.returnDataParts, 1);
        assert.equal(10000, decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])));

        query = smartContractController.createQuery({
            contract: contractAddress,
            function: "balanceOf",
            arguments: [new AddressValue(alice.address)],
        });
        queryResponse = await smartContractController.runQuery(query);
        assert.equal(7500, decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])));

        query = smartContractController.createQuery({
            contract: contractAddress,
            function: "balanceOf",
            arguments: [new AddressValue(bob.address)],
        });
        queryResponse = await smartContractController.runQuery(query);
        assert.equal(1000, decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])));

        query = smartContractController.createQuery({
            contract: contractAddress,
            function: "balanceOf",
            arguments: [new AddressValue(carol.address)],
        });
        queryResponse = await smartContractController.runQuery(query);
        assert.equal(1500, decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])));
    });

    it("lottery: should deploy, call and query contract using SmartContractTransactionsFactory", async function () {
        this.timeout(60000);

        TransactionWatcher.DefaultPollingInterval = 5000;
        TransactionWatcher.DefaultTimeout = 50000;

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        const config = new TransactionsFactoryConfig({ chainID: network.chainID });
        const factory = new SmartContractTransactionsFactory({ config: config });

        const bytecode = await promises.readFile("src/testdata/lottery-esdt.wasm");

        const deployTransaction = factory.createTransactionForDeploy(alice.address, {
            bytecode: bytecode,
            gasLimit: 50000000n,
        });
        deployTransaction.nonce = BigInt(alice.account.nonce.valueOf());

        const transactionComputer = new TransactionComputer();
        deployTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(deployTransaction)),
        );

        const contractAddress = SmartContract.computeAddress(alice.address, alice.account.nonce);
        alice.account.incrementNonce();

        const startTransaction = factory.createTransactionForExecute(alice.address, {
            contract: contractAddress,
            function: "start",
            gasLimit: 10000000n,
            arguments: [
                BytesValue.fromUTF8("lucky"),
                new TokenIdentifierValue("EGLD"),
                new BigUIntValue(1),
                OptionValue.newMissing(),
                OptionValue.newMissing(),
                OptionValue.newProvided(new U32Value(1)),
                OptionValue.newMissing(),
                OptionValue.newMissing(),
                OptionalValue.newMissing(),
            ],
        });
        startTransaction.nonce = BigInt(alice.account.nonce.valueOf());
        startTransaction.signature = await alice.signer.sign(
            Buffer.from(transactionComputer.computeBytesForSigning(startTransaction)),
        );

        alice.account.incrementNonce();

        // Broadcast & execute
        const deployTx = await provider.sendTransaction(deployTransaction);
        const startTx = await provider.sendTransaction(startTransaction);

        await watcher.awaitAllEvents(deployTx, ["SCDeploy"]);
        await watcher.awaitAnyEvent(startTx, ["completedTxEvent"]);

        // Let's check the SCRs
        let transactionOnNetwork = await provider.getTransaction(deployTx);
        let response = parser.parseExecute({ transactionOnNetwork });
        assert.isTrue(response.returnCode == "ok");

        transactionOnNetwork = await provider.getTransaction(startTx);
        response = parser.parseExecute({ transactionOnNetwork });
        assert.isTrue(response.returnCode == "ok");

        // Query state, do some assertions
        const smartContractQueriesController = new SmartContractController({
            chainID: "localnet",
            networkProvider: provider,
        });

        let query = smartContractQueriesController.createQuery({
            contract: contractAddress,
            function: "status",
            arguments: [BytesValue.fromUTF8("lucky")],
        });
        let queryResponse = await smartContractQueriesController.runQuery(query);
        assert.equal(decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])), 1);

        query = smartContractQueriesController.createQuery({
            contract: contractAddress,
            function: "status",
            arguments: [BytesValue.fromUTF8("missingLottery")],
        });
        queryResponse = await smartContractQueriesController.runQuery(query);
        assert.equal(decodeUnsignedNumber(Buffer.from(queryResponse.returnDataParts[0])), 0);
    });
});
