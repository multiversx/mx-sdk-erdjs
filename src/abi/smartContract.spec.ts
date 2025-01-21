import { assert } from "chai";
import { Address } from "../address";
import {
    loadTestWallets,
    MarkCompleted,
    MockNetworkProvider,
    setupUnitTestWatcherTimeouts,
    TestWallet,
    Wait,
} from "../testutils";
import { TransactionStatus } from "../transactionStatus";
import { TransactionWatcher } from "../transactionWatcher";
import { Code } from "./code";
import { ContractFunction } from "./function";
import { SmartContract } from "./smartContract";
import { AbiRegistry, OptionalValue, U32Value, U8Value, VariadicValue } from "./typesystem";
import { BytesValue } from "./typesystem/bytes";

describe("test contract", () => {
    let provider = new MockNetworkProvider();
    let chainID = "test";
    let alice: TestWallet;

    before(async function () {
        ({ alice } = await loadTestWallets());
    });

    it("should compute contract address", async () => {
        let owner = new Address("93ee6143cdc10ce79f15b2a6c2ad38e9b6021c72a1779051f47154fd54cfbd5e");

        let firstContractAddress = SmartContract.computeAddress(owner, 0n);
        assert.equal(firstContractAddress.toBech32(), "erd1qqqqqqqqqqqqqpgqhdjjyq8dr7v5yq9tv6v5vt9tfvd00vg7h40q6779zn");

        let secondContractAddress = SmartContract.computeAddress(owner, 1n);
        assert.equal(
            secondContractAddress.toBech32(),
            "erd1qqqqqqqqqqqqqpgqde8eqjywyu6zlxjxuxqfg5kgtmn3setxh40qen8egy",
        );
    });

    it("should deploy", async () => {
        setupUnitTestWatcherTimeouts();
        let watcher = new TransactionWatcher(provider);

        let contract = new SmartContract();
        let deployTransaction = contract.deploy({
            code: Code.fromBuffer(Buffer.from([1, 2, 3, 4])),
            gasLimit: 1000000n,
            chainID: chainID,
            deployer: alice.address,
        });

        provider.mockUpdateAccount(alice.address, (account) => {
            account.nonce = 42n;
        });

        await alice.sync(provider);
        deployTransaction.nonce = alice.account.nonce;

        assert.equal(deployTransaction.getData().valueOf().toString(), "01020304@0500@0100");
        assert.equal(deployTransaction.gasLimit, 1000000n);
        assert.equal(deployTransaction.nonce, 42n);

        // Compute & set the contract address
        contract.setAddress(SmartContract.computeAddress(alice.address, 42n));
        assert.equal(
            contract.getAddress().toBech32(),
            "erd1qqqqqqqqqqqqqpgq3ytm9m8dpeud35v3us20vsafp77smqghd8ss4jtm0q",
        );

        // Sign the transaction
        deployTransaction.applySignature(await alice.signer.sign(deployTransaction.serializeForSigning()));

        // Now let's broadcast the deploy transaction, and wait for its execution.
        let hash = await provider.sendTransaction(deployTransaction);

        await Promise.all([
            provider.mockTransactionTimeline(deployTransaction, [
                new Wait(40),
                new TransactionStatus("pending"),
                new Wait(40),
                new TransactionStatus("executed"),
                new MarkCompleted(),
            ]),
            watcher.awaitCompleted(deployTransaction.getHash().hex()),
        ]);

        assert.isTrue((await provider.getTransaction(hash)).status.isCompleted());
    });

    it("should call", async () => {
        setupUnitTestWatcherTimeouts();
        let watcher = new TransactionWatcher(provider);

        let contract = new SmartContract({
            address: new Address("erd1qqqqqqqqqqqqqpgqak8zt22wl2ph4tswtyc39namqx6ysa2sd8ss4xmlj3"),
        });

        provider.mockUpdateAccount(alice.address, (account) => {
            account.nonce = 42n;
        });

        let callTransactionOne = contract.call({
            func: new ContractFunction("helloEarth"),
            args: [new U32Value(5), BytesValue.fromHex("0123")],
            gasLimit: 150000n,
            chainID: chainID,
            caller: alice.address,
        });

        let callTransactionTwo = contract.call({
            func: new ContractFunction("helloMars"),
            args: [new U32Value(5), BytesValue.fromHex("0123")],
            gasLimit: 1500000n,
            chainID: chainID,
            caller: alice.address,
        });

        await alice.sync(provider);
        callTransactionOne.nonce = alice.account.nonce;
        alice.account.incrementNonce();
        callTransactionTwo.nonce = alice.account.nonce;

        assert.equal(callTransactionOne.nonce, 42n);
        assert.equal(callTransactionOne.getData().valueOf().toString(), "helloEarth@05@0123");
        assert.equal(callTransactionOne.gasLimit, 150000n);
        assert.equal(callTransactionTwo.nonce, 43n);
        assert.equal(callTransactionTwo.getData().valueOf().toString(), "helloMars@05@0123");
        assert.equal(callTransactionTwo.gasLimit, 1500000n);

        // Sign transactions, broadcast them
        callTransactionOne.applySignature(await alice.signer.sign(callTransactionOne.serializeForSigning()));
        callTransactionTwo.applySignature(await alice.signer.sign(callTransactionTwo.serializeForSigning()));

        let hashOne = await provider.sendTransaction(callTransactionOne);
        let hashTwo = await provider.sendTransaction(callTransactionTwo);

        await Promise.all([
            provider.mockTransactionTimeline(callTransactionOne, [
                new Wait(40),
                new TransactionStatus("pending"),
                new Wait(40),
                new TransactionStatus("executed"),
                new MarkCompleted(),
            ]),
            provider.mockTransactionTimeline(callTransactionTwo, [
                new Wait(40),
                new TransactionStatus("pending"),
                new Wait(40),
                new TransactionStatus("executed"),
                new MarkCompleted(),
            ]),
            watcher.awaitCompleted(callTransactionOne.getHash().hex()),
            watcher.awaitCompleted(callTransactionTwo.getHash().hex()),
        ]);

        assert.isTrue((await provider.getTransaction(hashOne)).status.isCompleted());
        assert.isTrue((await provider.getTransaction(hashTwo)).status.isCompleted());
    });

    it("should upgrade", async () => {
        setupUnitTestWatcherTimeouts();
        let watcher = new TransactionWatcher(provider);

        let contract = new SmartContract();
        contract.setAddress(Address.fromBech32("erd1qqqqqqqqqqqqqpgq3ytm9m8dpeud35v3us20vsafp77smqghd8ss4jtm0q"));

        let deployTransaction = contract.upgrade({
            code: Code.fromBuffer(Buffer.from([1, 2, 3, 4])),
            gasLimit: 1000000n,
            chainID: chainID,
            caller: alice.address,
        });

        provider.mockUpdateAccount(alice.address, (account) => {
            account.nonce = 42n;
        });

        await alice.sync(provider);
        deployTransaction.nonce = alice.account.nonce;

        assert.equal(deployTransaction.getData().valueOf().toString(), "upgradeContract@01020304@0100");
        assert.equal(deployTransaction.gasLimit, 1000000n);
        assert.equal(deployTransaction.nonce, 42n);

        // Sign the transaction
        deployTransaction.applySignature(await alice.signer.sign(deployTransaction.serializeForSigning()));

        // Now let's broadcast the deploy transaction, and wait for its execution.
        let hash = await provider.sendTransaction(deployTransaction);

        await Promise.all([
            provider.mockTransactionTimeline(deployTransaction, [
                new Wait(40),
                new TransactionStatus("pending"),
                new Wait(40),
                new TransactionStatus("executed"),
                new MarkCompleted(),
            ]),
            watcher.awaitCompleted(deployTransaction.getHash().hex()),
        ]);

        assert.isTrue((await provider.getTransaction(hash)).status.isCompleted());
    });

    it("v13 should be stricter than v12 on optional<variadic<type>> (exotic) parameters (since NativeSerializer is used under the hood)", async () => {
        // Related to: https://github.com/multiversx/mx-sdk-js-core/issues/435.
        // In v12, contract.call() only supported TypedValue[] as contract call arguments.
        // In v13, NativeSerializer is used under the hood, which allows one to mix typed values with native values.
        // However, this comes with additional rules regarding optional<variadic<?>> parameters.
        // These parameters are exotic and, generally speaking, can be avoided in contracts:
        // https://docs.multiversx.com/developers/data/multi-values/

        const abi = AbiRegistry.create({
            endpoints: [
                {
                    name: "foo",
                    inputs: [
                        {
                            type: "optional<variadic<u8>>",
                        },
                    ],
                },
            ],
        });

        const callerAddress = Address.fromBech32("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        const contractAddress = Address.fromBech32("erd1qqqqqqqqqqqqqpgqaxa53w6uk43n6dhyt2la6cd5lyv32qn4396qfsqlnk");

        const contract = new SmartContract({
            abi,
            address: contractAddress,
        });

        // This was possible in v12 (more permissive).
        // In v12, contract.call() required TypedValue[] for "args".
        assert.throws(() => {
            contract.call({
                func: "foo",
                args: [new U8Value(1), new U8Value(2), new U8Value(3)],
                chainID: "D",
                gasLimit: 1000000n,
                caller: callerAddress,
            });
        }, "Wrong number of arguments for endpoint foo: expected between 0 and 1 arguments, have 3");

        // In v13, the contract.call() would be as follows:
        contract.call({
            func: "foo",
            args: [[new U8Value(1), new U8Value(2), new U8Value(3)]],
            chainID: "D",
            gasLimit: 1000000n,
            caller: callerAddress,
        });

        // Or simply:
        contract.call({
            func: "foo",
            args: [[1, 2, 3]],
            chainID: "D",
            gasLimit: 1000000n,
            caller: callerAddress,
        });

        // This did not work in v12, it does not work in v13 either (since it's imprecise / incorrect).
        assert.throws(() => {
            contract.methods.foo([1, 2, 3]);
        }, "Wrong number of arguments for endpoint foo: expected between 0 and 1 arguments, have 3");

        const endpointFoo = abi.getEndpoint("foo");
        const optionalVariadicType = endpointFoo.input[0].type;
        const variadicTypedValue = VariadicValue.fromItems(new U8Value(1), new U8Value(2), new U8Value(3));

        // However, all these were and are still possible:
        contract.methodsExplicit.foo([new U8Value(1), new U8Value(2), new U8Value(3)]);
        contract.methods.foo([new OptionalValue(optionalVariadicType, variadicTypedValue)]);
        contract.methods.foo([variadicTypedValue]);
        contract.methods.foo([[new U8Value(1), new U8Value(2), new U8Value(3)]]);
        contract.methods.foo([[new U8Value(1), 2, 3]]);
    });

    it("v13 should be stricter than v12 on variadic<type> parameters (since NativeSerializer is used under the hood)", async () => {
        const abi = AbiRegistry.create({
            endpoints: [
                {
                    name: "foo",
                    inputs: [
                        {
                            type: "variadic<u8>",
                        },
                    ],
                },
            ],
        });

        const callerAddress = Address.fromBech32("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        const contractAddress = Address.fromBech32("erd1qqqqqqqqqqqqqpgqaxa53w6uk43n6dhyt2la6cd5lyv32qn4396qfsqlnk");

        const contract = new SmartContract({
            abi,
            address: contractAddress,
        });

        // This was possible in v12 (more permissive).
        // In v12, contract.call() required TypedValue[] for "args".
        assert.throws(() => {
            contract.call({
                func: "foo",
                args: [new U8Value(1), new U8Value(2), new U8Value(3)],
                chainID: "D",
                gasLimit: 1000000n,
                caller: callerAddress,
            });
        }, "Invalid argument: Wrong argument type for endpoint foo: typed value provided; expected variadic type, have U8Value");

        // In v13, the contract.call() would be as follows:
        contract.call({
            func: "foo",
            args: [VariadicValue.fromItems(new U8Value(1), new U8Value(2), new U8Value(3))],
            chainID: "D",
            gasLimit: 1000000n,
            caller: callerAddress,
        });

        // Or simply:
        contract.call({
            func: "foo",
            args: [1, 2, 3],
            chainID: "D",
            gasLimit: 1000000n,
            caller: callerAddress,
        });

        // However, all these were and are still possible:
        contract.methods.foo([1, 2, 3]);
        contract.methodsExplicit.foo([new U8Value(1), new U8Value(2), new U8Value(3)]);
        contract.methods.foo([VariadicValue.fromItems(new U8Value(1), new U8Value(2), new U8Value(3))]);
    });
});
