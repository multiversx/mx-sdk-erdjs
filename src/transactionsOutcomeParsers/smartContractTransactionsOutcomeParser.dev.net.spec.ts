import { assert } from "chai";
import { TransactionsConverter } from "../converters/transactionsConverter";
import { createDevnetProvider } from "../testutils/networkProviders";
import { SmartContractTransactionsOutcomeParser } from "./smartContractTransactionsOutcomeParser";

describe("test smart contract transactions outcome parser on devnet", () => {
    const networkProvider = createDevnetProvider();
    const parser = new SmartContractTransactionsOutcomeParser();
    const transactionsConverter = new TransactionsConverter();

    it("should parse outcome of deploy transactions (1)", async () => {
        const transactionHash = "5d2ff2af8eb3fe7f2acb7e29c0436854b4c6c44de02878b6afff582888024a55";
        const transactionOnNetwork = await networkProvider.getTransaction(transactionHash);
        const transactionOutcome = transactionsConverter.transactionOnNetworkToOutcome(transactionOnNetwork);
        const parsedGivenTransactionOnNetwork = parser.parseDeploy({ transactionOnNetwork });
        const parsedGivenTransactionOutcome = parser.parseDeploy({ transactionOutcome });

        assert.deepEqual(parsedGivenTransactionOnNetwork, parsedGivenTransactionOutcome);
        assert.equal(parsedGivenTransactionOnNetwork.returnCode, "ok");
        assert.deepEqual(parsedGivenTransactionOnNetwork.contracts, [
            {
                address: "erd1qqqqqqqqqqqqqpgqpayq2es08gq8798xhnpr0kzgn7495qt5q6uqd7lpwf",
                ownerAddress: "erd1tn62hjp72rznp8vq0lplva5csav6rccpqqdungpxtqz0g2hcq6uq9k4cc6",
                codeHash: Buffer.from("c876625ec34a04445cfd99067777ebe488afdbc6899cd958f4c1d36107ca02d9", "hex"),
            },
        ]);
    });

    it("should parse outcome of deploy transactions (2)", async () => {
        const transactionHash = "76683e926dad142fc9651afca208487f2a80d327fc87e5c876eec9d028196352";
        const transactionOnNetwork = await networkProvider.getTransaction(transactionHash);
        const transactionOutcome = transactionsConverter.transactionOnNetworkToOutcome(transactionOnNetwork);
        const parsedGivenTransactionOnNetwork = parser.parseDeploy({ transactionOnNetwork });
        const parsedGivenTransactionOutcome = parser.parseDeploy({ transactionOutcome });

        assert.deepEqual(parsedGivenTransactionOnNetwork, parsedGivenTransactionOutcome);
        assert.equal(parsedGivenTransactionOnNetwork.returnCode, "execution failed");
        assert.lengthOf(parsedGivenTransactionOnNetwork.contracts, 0);
    });

    it.skip("should parse outcome of relayed V3 inner transactions (1)", async () => {
        const transactionHash = "c798e8c03d93aa4e3425f63fe020572304305e2017b1053c9f4e56f2c46bafd7";
        const transactionOnNetwork = await networkProvider.getTransaction(transactionHash);

        const parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![0] });
        assert.deepEqual(parsed.values, [Buffer.from([1])]);
        assert.equal(parsed.returnCode, "ok");
        assert.equal(parsed.returnMessage, "ok");
    });

    it.skip("should parse outcome of relayed V3 inner transactions (2)", async () => {
        const transactionHash = "eaf80014f1b413191ac6a04a81c3751c5563aff246021f4f7c4ba9723fa3b536";
        const transactionOnNetwork = await networkProvider.getTransaction(transactionHash);

        let parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![0] });
        assert.deepEqual(parsed.values, [Buffer.from([42]), Buffer.from([43]), Buffer.from([44])]);
        assert.equal(parsed.returnCode, "ok");
        assert.equal(parsed.returnMessage, "ok");

        parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![1] });
        assert.deepEqual(parsed.values, []);
        assert.equal(parsed.returnCode, "");
        assert.equal(parsed.returnMessage, "");
    });

    it.skip("should parse outcome of relayed V3 inner transactions (3)", async () => {
        const transactionHash = "d241307c92c66cfe8ce723656d8b2c47a4a4f9e457eec305155debba6c92ca1b";
        const transactionOnNetwork = await networkProvider.getTransaction(transactionHash);

        let parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![0] });
        assert.deepEqual(parsed.values, [Buffer.from([42]), Buffer.from([43]), Buffer.from([44])]);
        assert.equal(parsed.returnCode, "ok");
        assert.equal(parsed.returnMessage, "ok");

        // Signal error is not recoverable (for the moment).
        parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![1] });
        assert.deepEqual(parsed.values, []);
        assert.equal(parsed.returnCode, "");
        assert.equal(parsed.returnMessage, "");
    });

    it.skip("should parse outcome of relayed V3 inner transactions (4)", async () => {
        const transactionHash = "4bb3bc0f069fe4cf6a19750db026cca0968b224a59a2bfe6eee834c19d73cb80";
        const transactionOnNetwork = await networkProvider.getTransaction(transactionHash);

        let parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![0] });
        assert.deepEqual(parsed.values, [Buffer.from([42]), Buffer.from([43]), Buffer.from([44])]);
        assert.equal(parsed.returnCode, "ok");
        assert.equal(parsed.returnMessage, "ok");

        // Signal error is not recoverable (for the moment).
        parsed = parser.parseExecute({ transactionOnNetwork: transactionOnNetwork.innerTransactions![1] });
        assert.deepEqual(parsed.values, [Buffer.from([42]), Buffer.from([43]), Buffer.from([44])]);
        assert.equal(parsed.returnCode, "ok");
        assert.equal(parsed.returnMessage, "ok");
    });
});
