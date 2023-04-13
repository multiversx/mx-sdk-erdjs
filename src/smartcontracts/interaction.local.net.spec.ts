import BigNumber from "bignumber.js";
import { assert } from "chai";
import { loadAbiRegistry, loadTestWallets, prepareDeployment, TestWallet } from "../testutils";
import { ContractController } from "../testutils/contractController";
import { createLocalnetProvider } from "../testutils/networkProviders";
import { Transaction } from "../transaction";
import { Interaction } from "./interaction";
import { ReturnCode } from "./returnCode";
import { SmartContract } from "./smartContract";


describe("test smart contract interactor", function () {
    let provider = createLocalnetProvider();
    let alice: TestWallet;

    before(async function () {
        ({ alice } = await loadTestWallets());
    });

    it("should interact with 'answer' (local testnet)", async function () {
        this.timeout(80000);

        let abiRegistry = await loadAbiRegistry("src/testdata/answer.abi.json");
        let contract = new SmartContract({ abi: abiRegistry });
        let controller = new ContractController(provider);

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        // Deploy the contract
        let deployTransaction = await prepareDeployment({
            contract: contract,
            deployer: alice,
            codePath: "src/testdata/answer.wasm",
            gasLimit: 3000000,
            initArguments: [],
            chainID: network.ChainID
        });

        let { bundle: { returnCode } } = await controller.deploy(deployTransaction);
        assert.isTrue(returnCode.isSuccess());

        const interaction = <Interaction>contract.methods.getUltimateAnswer()
            .withGasLimit(3000000)
            .withChainID(network.ChainID)
            .withSender(alice.address);

        // Query
        let queryResponseBundle = await controller.query(interaction);
        assert.lengthOf(queryResponseBundle.values, 1);
        assert.deepEqual(queryResponseBundle.firstValue!.valueOf(), new BigNumber(42));
        assert.isTrue(queryResponseBundle.returnCode.equals(ReturnCode.Ok));

        // Execute, do not wait for execution
        let transaction = interaction
            .withSender(alice.address)
            .useThenIncrementNonceOf(alice)
            .buildTransaction();

        await signTransaction({ transaction: transaction, wallet: alice });
        await provider.sendTransaction(transaction);

        // Execute, and wait for execution
        transaction = interaction
            .withSender(alice.address)
            .useThenIncrementNonceOf(alice)
            .buildTransaction();

        await signTransaction({ transaction: transaction, wallet: alice });
        let { bundle: executionResultsBundle } = await controller.execute(interaction, transaction);

        assert.lengthOf(executionResultsBundle.values, 1);
        assert.deepEqual(executionResultsBundle.firstValue!.valueOf(), new BigNumber(42));
        assert.isTrue(executionResultsBundle.returnCode.equals(ReturnCode.Ok));
    });

    it("should interact with 'counter' (local testnet)", async function () {
        this.timeout(120000);

        let abiRegistry = await loadAbiRegistry("src/testdata/counter.abi.json");
        let contract = new SmartContract({ abi: abiRegistry });
        let controller = new ContractController(provider);

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        // Deploy the contract
        let deployTransaction = await prepareDeployment({
            contract: contract,
            deployer: alice,
            codePath: "src/testdata/counter.wasm",
            gasLimit: 3000000,
            initArguments: [],
            chainID: network.ChainID
        });

        let { bundle: { returnCode } } = await controller.deploy(deployTransaction);
        assert.isTrue(returnCode.isSuccess());

        let getInteraction = <Interaction>contract.methods.get();
        let incrementInteraction = (<Interaction>contract.methods.increment())
            .withGasLimit(3000000)
            .withChainID(network.ChainID)
            .withSender(alice.address);
        let decrementInteraction = (<Interaction>contract.methods.decrement())
            .withGasLimit(3000000)
            .withChainID(network.ChainID)
            .withSender(alice.address);

        // Query "get()"
        let { firstValue: counterValue } = await controller.query(getInteraction);
        assert.deepEqual(counterValue!.valueOf(), new BigNumber(1));

        // Increment, wait for execution.
        let incrementTransaction = incrementInteraction.useThenIncrementNonceOf(alice).buildTransaction();
        await signTransaction({ transaction: incrementTransaction, wallet: alice });
        let { bundle: { firstValue: valueAfterIncrement } } = await controller.execute(incrementInteraction, incrementTransaction);
        assert.deepEqual(valueAfterIncrement!.valueOf(), new BigNumber(2));

        // Decrement twice. Wait for execution of the second transaction.
        let decrementTransaction = decrementInteraction.useThenIncrementNonceOf(alice).buildTransaction();
        await signTransaction({ transaction: decrementTransaction, wallet: alice });
        await provider.sendTransaction(decrementTransaction);

        decrementTransaction = decrementInteraction.useThenIncrementNonceOf(alice).buildTransaction();
        await signTransaction({ transaction: decrementTransaction, wallet: alice });
        let { bundle: { firstValue: valueAfterDecrement } } = await controller.execute(decrementInteraction, decrementTransaction);
        assert.deepEqual(valueAfterDecrement!.valueOf(), new BigNumber(0));
    });

    it("should interact with 'lottery-esdt' (local testnet)", async function () {
        this.timeout(140000);

        let abiRegistry = await loadAbiRegistry("src/testdata/lottery-esdt.abi.json");
        let contract = new SmartContract({ abi: abiRegistry });
        let controller = new ContractController(provider);

        let network = await provider.getNetworkConfig();
        await alice.sync(provider);

        // Deploy the contract
        let deployTransaction = await prepareDeployment({
            contract: contract,
            deployer: alice,
            codePath: "src/testdata/lottery-esdt.wasm",
            gasLimit: 100000000,
            initArguments: [],
            chainID: network.ChainID
        });

        let { bundle: { returnCode } } = await controller.deploy(deployTransaction);
        assert.isTrue(returnCode.isSuccess());

        let startInteraction = <Interaction>contract.methods.start([
            "lucky",
            "EGLD",
            1,
            null,
            null,
            1,
            null,
            null
        ])
            .withGasLimit(30000000)
            .withChainID(network.ChainID)
            .withSender(alice.address);

        let lotteryStatusInteraction = <Interaction>contract.methods.status(["lucky"])
            .withGasLimit(5000000)
            .withChainID(network.ChainID)
            .withSender(alice.address);

        let getLotteryInfoInteraction = <Interaction>contract.methods.getLotteryInfo(["lucky"])
            .withGasLimit(5000000)
            .withChainID(network.ChainID)
            .withSender(alice.address);

        // start()
        let startTransaction = startInteraction
            .withSender(alice.address)
            .useThenIncrementNonceOf(alice)
            .buildTransaction();

        await signTransaction({ transaction: startTransaction, wallet: alice });
        let { bundle: bundleStart } = await controller.execute(startInteraction, startTransaction);
        assert.isTrue(bundleStart.returnCode.equals(ReturnCode.Ok));
        assert.lengthOf(bundleStart.values, 0);

        // status()
        let lotteryStatusTransaction = lotteryStatusInteraction
            .withSender(alice.address)
            .useThenIncrementNonceOf(alice)
            .buildTransaction();

        await signTransaction({ transaction: lotteryStatusTransaction, wallet: alice });
        let { bundle: bundleStatus } = await controller.execute(lotteryStatusInteraction, lotteryStatusTransaction);
        assert.isTrue(bundleStatus.returnCode.equals(ReturnCode.Ok));
        assert.lengthOf(bundleStatus.values, 1);
        assert.equal(bundleStatus.firstValue!.valueOf().name, "Running");

        // lotteryInfo() (this is a view function, but for the sake of the test, we'll execute it)
        let lotteryInfoTransaction = getLotteryInfoInteraction
            .withSender(alice.address)
            .useThenIncrementNonceOf(alice)
            .buildTransaction();

        await signTransaction({ transaction: lotteryInfoTransaction, wallet: alice });
        let { bundle: bundleLotteryInfo } = await controller.execute(getLotteryInfoInteraction, lotteryInfoTransaction);
        assert.isTrue(bundleLotteryInfo.returnCode.equals(ReturnCode.Ok));
        assert.lengthOf(bundleLotteryInfo.values, 1);

        // Ignore "deadline" field in our test
        let info = bundleLotteryInfo.firstValue!.valueOf();
        delete info.deadline;

        assert.deepEqual(info, {
            token_identifier: "EGLD",
            ticket_price: new BigNumber("1"),
            tickets_left: new BigNumber(800),
            max_entries_per_user: new BigNumber(1),
            prize_distribution: Buffer.from([0x64]),
            prize_pool: new BigNumber("0")
        });
    });

    async function signTransaction(options: { transaction: Transaction, wallet: TestWallet }) {
        const transaction = options.transaction;
        const wallet = options.wallet;

        const serialized = transaction.serializeForSigning();
        const signature = await wallet.signerNext.sign(serialized);
        transaction.applySignature(signature);
    }
});
