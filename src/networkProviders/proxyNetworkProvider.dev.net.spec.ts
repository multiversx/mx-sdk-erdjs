import { assert, expect } from "chai";
import { Address } from "../address";
import { SmartContractQuery } from "../smartContractQuery";
import { loadTestWallet } from "../testutils/wallets";
import { Token } from "../tokens";
import { Transaction } from "../transaction";
import { TransactionComputer } from "../transactionComputer";
import { TransactionOnNetwork } from "../transactionOnNetwork";
import { TransactionStatus } from "../transactionStatus";
import { ProxyNetworkProvider } from "./proxyNetworkProvider";

describe("ProxyNetworkProvider Tests", function () {
    const proxy = new ProxyNetworkProvider("https://devnet-gateway.multiversx.com");

    it("should fetch network configuration", async () => {
        const result = await proxy.getNetworkConfig();
        assert.equal(result.chainID, "D");
        assert.equal(result.gasPerDataByte, 1500n);
        assert.equal(result.roundDuration, 6000);
        assert.equal(result.minGasLimit, 50000n);
        assert.equal(result.minGasPrice, 1_000_000_000n);
        assert.exists(result.raw);
    });

    it("should fetch network status", async () => {
        const result = await proxy.getNetworkStatus();
        assert.exists(result.blockNonce);
        assert.exists(result.currentRound);
        assert.exists(result.blockTimestamp);
        assert.exists(result.currentEpoch);
        assert.exists(result.highestFinalNonce);
        assert.exists(result.raw);
    });

    it("should fetch block details by hash and nonce", async () => {
        const shard = 1;
        const blockHash = "ded535cc0afb2dc5f9787e9560dc48d0b83564a3f994a390b228d894d854699f";
        const resultByHash = await proxy.getBlock({ shard, blockHash });

        const blockNonce = 5949242n;
        const resultByNonce = await proxy.getBlock({ shard, blockNonce });

        assert.equal(resultByHash.hash, blockHash);
        assert.equal(resultByHash.nonce, 5949242n);
        assert.equal(resultByHash.shard, 1);
        assert.equal(resultByHash.timestamp, 1730112578);
        assert.deepEqual(resultByHash, resultByNonce);
    });

    it("should fetch the latest block", async () => {
        const result = await proxy.getLatestBlock();
        expect(result).to.exist;
    });

    it("should fetch account details", async () => {
        const address1 = Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        const result1 = await proxy.getAccount(address1);

        assert.equal(result1.address.toBech32(), "erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        assert.isUndefined(result1.userName);
        assert.isUndefined(result1.contractOwnerAddress);

        const address2 = Address.newFromBech32("erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen");
        const result2 = await proxy.getAccount(address2);

        assert.equal(result2.address.toBech32(), "erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen");
        assert.isUndefined(result2.userName);
        assert.equal(
            result2.contractOwnerAddress?.toBech32(),
            "erd1wzx0tak22f2me4g7wpxfae2w3htfue7khrg28fy6wu8x9hzq05vqm8qhnm",
        );
        assert.isFalse(result2.isContractPayable);
        assert.isTrue(result2.isContractReadable);
    });

    it("should fetch account storage", async () => {
        const address = Address.newFromBech32("erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen");
        const result = await proxy.getAccountStorage(address);

        assert.equal(result.entries.length, 1);
        assert.equal(result.entries[0].key, "sum");
        assert.exists(result.entries[0].value);
    });

    it("should fetch a storage entry for an account", async () => {
        const address = Address.newFromBech32("erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen");
        const result = await proxy.getAccountStorageEntry(address, "sum");

        assert.equal(result.key, "sum");
        assert.exists(result.value);
    });

    it("should fetch token of an account", async () => {
        const address = Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        let token = await proxy.getTokenOfAccount(address, new Token({ identifier: "TEST-ff155e" }));

        assert.equal(token.token.identifier, "TEST-ff155e");
        assert.equal(token.amount, 99999999999980000n);

        token = await proxy.getTokenOfAccount(address, new Token({ identifier: "NFTEST-ec88b8", nonce: 1n }));

        assert.equal(token.token.identifier, "NFTEST-ec88b8");
        assert.equal(token.amount, 1n);
        assert.equal(token.token.nonce, 1n);
    });

    it("should fetch fungible tokens of an account", async () => {
        const address = Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        const tokens = await proxy.getFungibleTokensOfAccount(address);
        assert.isTrue(tokens.length > 0);

        const filtered = tokens.filter((token) => token.token.identifier === "TEST-ff155e");
        assert.equal(filtered.length, 1);
        assert.equal(filtered[0].token.identifier, "TEST-ff155e");
        assert.equal(filtered[0].amount.toString(), "99999999999980000");
    });

    it("should fetch non-fungible tokens of an account", async () => {
        const address = Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        const tokens = await proxy.getNonFungibleTokensOfAccount(address);
        assert.isTrue(tokens.length > 0);

        const filtered = tokens.filter((token) => token.token.identifier === "NFTEST-ec88b8-01");
        assert.equal(filtered.length, 1);
        assert.equal(filtered[0].token.identifier, "NFTEST-ec88b8-01");
        assert.equal(filtered[0].token.nonce, 1n);
        assert.equal(filtered[0].amount, 1n);
    });

    it("should fetch definition of fungible token", async () => {
        const token = await proxy.getDefinitionOfFungibleToken("TEST-ff155e");

        assert.equal(token.identifier, "TEST-ff155e");
        assert.equal(token.owner.toBech32(), "erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        assert.equal(token.decimals, 6);
    });

    it("should fetch definition of token collection", async () => {
        const token = await proxy.getDefinitionOfTokenCollection("NFTEST-ec88b8");

        assert.equal(token.collection, "NFTEST-ec88b8");
        assert.equal(token.owner.toBech32(), "erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl");
        assert.equal(token.type, "NonFungibleESDT");
        assert.equal(token.decimals, 0);
    });

    it("should fetch transaction", async () => {
        const transaction = await proxy.getTransaction(
            "9d47c4b4669cbcaa26f5dec79902dd20e55a0aa5f4b92454a74e7dbd0183ad6c",
        );

        assert.equal(transaction.nonce, 0n);
        assert.equal(transaction.epoch, 348);
        assert.equal(transaction.hash, "9d47c4b4669cbcaa26f5dec79902dd20e55a0aa5f4b92454a74e7dbd0183ad6c");
        assert.isTrue(transaction.status.isCompleted());
        assert.equal(transaction.sender.toBech32(), "erd18s6a06ktr2v6fgxv4ffhauxvptssnaqlds45qgsrucemlwc8rawq553rt2");
        assert.deepEqual(transaction.smartContractResults, []);
    });

    it("should fetch transaction with events", async () => {
        const transaction = await proxy.getTransaction(
            "6fe05e4ca01d42c96ae5182978a77fe49f26bcc14aac95ad4f19618173f86ddb",
        );

        assert.exists(transaction.logs);
        assert.exists(transaction.logs.events);
        assert.equal(transaction.logs.events.length, 2);
        assert.equal(transaction.logs.events[0].topics.length, 8);
        assert.equal(Buffer.from(transaction.logs.events[0].topics[0]).toString("hex"), "544553542d666631353565");
        assert.equal(Buffer.from(transaction.logs.events[0].topics[1]).toString("hex"), "");
        assert.equal(Buffer.from(transaction.logs.events[0].topics[2]).toString("hex"), "63616e4368616e67654f776e6572");
        assert.equal(transaction.hash, "6fe05e4ca01d42c96ae5182978a77fe49f26bcc14aac95ad4f19618173f86ddb");
        assert.isTrue(transaction.status.isCompleted());
    });

    it("should fetch smart contract invoking transaction", async () => {
        const transaction = await proxy.getTransaction(
            "6fe05e4ca01d42c96ae5182978a77fe49f26bcc14aac95ad4f19618173f86ddb",
        );

        assert.isTrue(transaction.status.isCompleted());
        assert.isTrue(transaction.smartContractResults.length > 2);
        assert.deepEqual(
            transaction.data,
            Buffer.from(
                "issue@54455354546f6b656e@54455354@016345785d8a0000@06@63616e4368616e67654f776e6572@74727565@63616e55706772616465@74727565@63616e4164645370656369616c526f6c6573@74727565",
            ),
        );
        assert.equal(Buffer.from(transaction.logs.events[0].topics[0]).toString("hex"), "544553542d666631353565");
        assert.equal(Buffer.from(transaction.logs.events[0].topics[1]).toString("hex"), "");
        assert.equal(Buffer.from(transaction.logs.events[0].topics[2]).toString("hex"), "63616e4368616e67654f776e6572");
        assert.equal(transaction.hash, "6fe05e4ca01d42c96ae5182978a77fe49f26bcc14aac95ad4f19618173f86ddb");
    });

    it("should send transaction", async () => {
        const transaction = new Transaction({
            sender: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
            receiver: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
            gasLimit: 50000n,
            chainID: "D",
            value: 5000000000000000000n,
            nonce: 100n,
            gasPrice: 1000000000n,
            version: 2,
            signature: Buffer.from(
                "faf50b8368cb2c20597dad671a14aa76d4c65937d6e522c64946f16ad6a250262463e444596fa7ee2af1273f6ad0329d43af48d1ae5f3b295bc8f48fdba41a05",
                "hex",
            ),
        });

        const expectedHash = "fc914860c1d137ed8baa602e561381f97c7bad80d150c5bf90760d3cfd3a4cea";
        assert.equal(await proxy.sendTransaction(transaction), expectedHash);
    });

    it("should send transaction  with data", async () => {
        const transaction = new Transaction({
            sender: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
            receiver: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
            gasLimit: 70000n,
            chainID: "D",
            nonce: 105n,
            gasPrice: 1000000000n,
            version: 2,
            data: new Uint8Array(Buffer.from("foo")),
            signature: Buffer.from(
                "7a8bd08351bac6b1113545f5a896cb0b63806abd93d639bc4d16bfbc82c7b514f68ed7b36c743f4c3d2d1e1d3cb356824041d51dfe587a149f6fc9ab0dd9c408",
                "hex",
            ),
        });

        const expectedHash = "4dc7d4e18c0cf9ca7f17677ef0ac3d1363528e892996b518bee909bb17cf7929";
        assert.equal(await proxy.sendTransaction(transaction), expectedHash);
    });

    it("should send transactions", async () => {
        const txs = [
            new Transaction({
                nonce: 103n,
                receiver: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
                sender: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
                gasPrice: 1000000000n,
                gasLimit: 50000n,
                chainID: "D",
                version: 2,
                signature: Buffer.from(
                    "498d5abb9f8eb69cc75f24320e8929dadbfa855ffac220d5e92175a83be68e0437801af3a1411e3d839738230097a1c38da5c8c4df3f345defc5d40300675900",
                    "hex",
                ),
            }),
            new Transaction({
                nonce: 77n,
                chainID: "D",
                receiver: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
                sender: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
                gasLimit: 50000n,
                gasPrice: 1000000000n,
            }),
            new Transaction({
                nonce: 104n,
                receiver: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
                sender: Address.newFromBech32("erd1487vz5m4zpxjyqw4flwa3xhnkzg4yrr3mkzf5sf0zgt94hjprc8qazcccl"),
                gasPrice: 1000000000n,
                gasLimit: 50000n,
                chainID: "D",
                version: 2,
                signature: Buffer.from(
                    "341a2f3b738fbd20692e3bbd1cb36cb5f4ce9c0a9acc0cf4322269c0fcf34fd6bb59cd94062a9a4730e47f41b1ef3e29b69c6ab2a2a4dca9c9a7724681bc1708",
                    "hex",
                ),
            }),
        ];

        const expectedHashes = [
            "61b4f2561fc57bfb8b8971ed23cd64259b664bc0404ea7a0449def8ceef24b08",
            null,
            "30274b60b5635f981fa89ccfe726a34ca7121caa5d34123021c77a5c64cc9163",
        ];
        const [numOfSentTxs, hashes] = await proxy.sendTransactions(txs);
        assert.equal(numOfSentTxs, 2);
        assert.deepEqual(hashes, expectedHashes);
    });

    it("should simulate transaction", async () => {
        const bob = await loadTestWallet("bob");
        const transactionComputer = new TransactionComputer();
        let transaction = new Transaction({
            sender: bob.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "D",
            signature: Buffer.from(Array(128).fill("0").join(""), "hex"),
        });
        const nonce = (await proxy.getAccount(bob.address)).nonce;
        transaction.nonce = nonce;
        let txOnNetwork = await proxy.simulateTransaction(transaction);
        assert.deepEqual(txOnNetwork.status, new TransactionStatus("success"));

        transaction.signature = await bob.signer.sign(transactionComputer.computeBytesForSigning(transaction));
        txOnNetwork = await proxy.simulateTransaction(transaction);

        transaction = new Transaction({
            sender: bob.address,
            receiver: Address.newFromBech32("erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen"),
            gasLimit: 10000000n,
            chainID: "D",
            gasPrice: 1000000000n,
            version: 2,
            data: new Uint8Array(Buffer.from("add@07")),
            nonce: nonce,
            signature: Buffer.from(Array(128).fill("0").join(""), "hex"),
        });

        txOnNetwork = await proxy.simulateTransaction(transaction);
        assert.equal(txOnNetwork.smartContractResults.length, 1);
        assert.equal(
            txOnNetwork.smartContractResults[0].sender.toBech32(),
            "erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen",
        );
        assert.equal(txOnNetwork.smartContractResults[0].receiver.toBech32(), bob.address.toBech32());
        assert.equal(txOnNetwork.smartContractResults[0].data, "@6f6b");

        transaction.signature = await bob.signer.sign(transactionComputer.computeBytesForSigning(transaction));
        txOnNetwork = await proxy.simulateTransaction(transaction);

        assert.deepEqual(txOnNetwork.status, new TransactionStatus("success"));
        assert.equal(txOnNetwork.smartContractResults.length, 1);
        assert.equal(
            txOnNetwork.smartContractResults[0].sender.toBech32(),
            "erd1qqqqqqqqqqqqqpgq076flgeualrdu5jyyj60snvrh7zu4qrg05vqez5jen",
        );
        assert.equal(txOnNetwork.smartContractResults[0].receiver.toBech32(), bob.address.toBech32());
        assert.equal(txOnNetwork.smartContractResults[0].data, "@6f6b", "base64");
    });

    it("should estimate transaction cost", async function () {
        const bob = await loadTestWallet("bob");
        const transactionComputer = new TransactionComputer();
        const transaction = new Transaction({
            sender: bob.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "D",
            data: new Uint8Array(Buffer.from("test transaction")),
        });
        transaction.nonce = (await proxy.getAccount(bob.address)).nonce;
        transaction.signature = await bob.signer.sign(transactionComputer.computeBytesForSigning(transaction));
        const response = await proxy.estimateTransactionCost(transaction);
        assert.equal(response.gasLimit, 74000);
    });

    it("should send and await for completed transaction", async function () {
        this.timeout(40000);
        const bob = await loadTestWallet("bob");
        const transactionComputer = new TransactionComputer();
        let transaction = new Transaction({
            sender: bob.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "D",
        });
        const nonce = (await proxy.getAccount(bob.address)).nonce;
        transaction.nonce = nonce;
        transaction.signature = await bob.signer.sign(transactionComputer.computeBytesForSigning(transaction));
        let hash = await proxy.sendTransaction(transaction);
        let transactionOnNetwork = await proxy.awaitTransactionCompleted(hash);
        assert.isTrue(transactionOnNetwork.status.isCompleted());

        transaction = new Transaction({
            sender: bob.address,
            receiver: Address.newFromBech32("erd1qqqqqqqqqqqqqpgqhdqz9j3zgpl8fg2z0jzx9n605gwxx4djd8ssruw094"),
            gasLimit: 5000000n,
            chainID: "D",
            data: new Uint8Array(Buffer.from("dummy@05")),
        });
        transaction.nonce = nonce + 1n;
        transaction.signature = await bob.signer.sign(transactionComputer.computeBytesForSigning(transaction));
        const condition = (txOnNetwork: TransactionOnNetwork) => !txOnNetwork.status.isSuccessful();

        hash = await proxy.sendTransaction(transaction);
        transactionOnNetwork = await proxy.awaitTransactionOnCondition(hash, condition);
        assert.isFalse(transactionOnNetwork.status.isSuccessful());
    });

    it("should fetch transaction status", async () => {
        const txHash = "9d47c4b4669cbcaa26f5dec79902dd20e55a0aa5f4b92454a74e7dbd0183ad6c";
        const result = await proxy.getTransactionStatus(txHash);
        assert.equal(result.status, "success");
    });

    it("should query contract", async () => {
        const query = new SmartContractQuery({
            contract: Address.newFromBech32("erd1qqqqqqqqqqqqqpgqqy34h7he2ya6qcagqre7ur7cc65vt0mxrc8qnudkr4"),
            function: "getSum",
            arguments: [],
        });
        const result = await proxy.queryContract(query);
        assert.equal(result.returnDataParts.length, 1);
    });
});
