import { assert, expect } from "chai";
import { SmartContractTransactionIntentsFactory } from "./smartContractTransactionIntentsFactory";
import { Address } from "../address";
import { Code } from "../smartcontracts/code";
import { AbiRegistry } from "../smartcontracts/typesystem/abiRegistry";
import { U32Value } from "../smartcontracts";
import { CONTRACT_DEPLOY_ADDRESS } from "../constants";
import { loadContractCode, loadAbiRegistry } from "../testutils/utils";
import { Err } from "../errors";

describe("test smart contract intents factory", function () {
    let factory: SmartContractTransactionIntentsFactory;
    let abiAwareFactory: SmartContractTransactionIntentsFactory;
    let adderByteCode: Code;
    let abiRegistry: AbiRegistry;

    before(async function () {
        factory = new SmartContractTransactionIntentsFactory({
            config:
            {
                chainID: "D",
                minGasLimit: 50000,
                gasLimitPerByte: 1500
            }
        });

        adderByteCode = await loadContractCode("src/testdata/adder.wasm");
        abiRegistry = await loadAbiRegistry("src/testdata/adder.abi.json");

        abiAwareFactory = new SmartContractTransactionIntentsFactory({
            config:
            {
                chainID: "D",
                minGasLimit: 50000,
                gasLimitPerByte: 1500
            },
            abi: abiRegistry
        },
        );
    });

    it("should throw error when args are not of type 'TypedValue'", async function () {
        const sender = Address.fromBech32("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        const gasLimit = 6000000;
        const args = [0];

        assert.throws(() => factory.createTransactionIntentForDeploy({
            sender: sender,
            bytecode: adderByteCode.valueOf(),
            gasLimit: gasLimit,
            args: args
        }), Err, "Can't convert args to TypedValues");
    });

    it("should build intent for deploy", async function () {
        const sender = Address.fromBech32("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        const gasLimit = 6000000;
        const args = [new U32Value(0)];

        const deployIntent = factory.createTransactionIntentForDeploy({
            sender: sender,
            bytecode: adderByteCode.valueOf(),
            gasLimit: gasLimit,
            args: args
        });
        const abiDeployIntent = abiAwareFactory.createTransactionIntentForDeploy({
            sender: sender,
            bytecode: adderByteCode.valueOf(),
            gasLimit: gasLimit,
            args: args
        });

        assert.equal(deployIntent.sender, "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        assert.equal(deployIntent.receiver, CONTRACT_DEPLOY_ADDRESS);
        assert.isDefined(deployIntent.data);
        expect(deployIntent.data?.length).to.be.greaterThan(0);

        if (deployIntent.data) {
            const expectedGasLimit = 6000000 + 50000 + 1500 * deployIntent.data.length;
            assert.equal(deployIntent.gasLimit.valueOf(), expectedGasLimit);
        }
        assert.equal(deployIntent.value, 0);

        assert.deepEqual(deployIntent, abiDeployIntent);
    });

    it("should build intent for execute", async function () {
        const sender = Address.fromBech32("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        const contract = Address.fromBech32("erd1qqqqqqqqqqqqqpgqhy6nl6zq07rnzry8uyh6rtyq0uzgtk3e69fqgtz9l4");
        const func = "add";
        const gasLimit = 6000000;
        const args = [new U32Value(7)];

        const deployIntent = factory.createTransactionIntentForExecute({
            sender: sender,
            contractAddress: contract,
            func: func,
            gasLimit: gasLimit,
            args: args
        });
        const abiDeployIntent = abiAwareFactory.createTransactionIntentForExecute({
            sender: sender,
            contractAddress: contract,
            func: func,
            gasLimit: gasLimit,
            args: args
        });

        assert.equal(deployIntent.sender, "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        assert.equal(deployIntent.receiver, "erd1qqqqqqqqqqqqqpgqhy6nl6zq07rnzry8uyh6rtyq0uzgtk3e69fqgtz9l4");

        assert.isDefined(deployIntent.data);
        assert.deepEqual(deployIntent.data, Buffer.from("add@07"));

        assert.equal(deployIntent.gasLimit.valueOf(), 6059000);
        assert.equal(deployIntent.value, 0);

        assert.deepEqual(deployIntent, abiDeployIntent);
    });

    it("should build intent for upgrade", async function () {
        const sender = Address.fromBech32("erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        const contract = Address.fromBech32("erd1qqqqqqqqqqqqqpgqhy6nl6zq07rnzry8uyh6rtyq0uzgtk3e69fqgtz9l4");
        const gasLimit = 6000000;
        const args = [new U32Value(0)];

        const deployIntent = factory.createTransactionIntentForUpgrade({
            sender: sender,
            contract: contract,
            bytecode: adderByteCode.valueOf(),
            gasLimit: gasLimit,
            args: args
        });
        const abiDeployIntent = abiAwareFactory.createTransactionIntentForUpgrade({
            sender: sender,
            contract: contract,
            bytecode: adderByteCode.valueOf(),
            gasLimit: gasLimit,
            args: args
        });

        assert.equal(deployIntent.sender, "erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th");
        assert.equal(deployIntent.receiver, "erd1qqqqqqqqqqqqqpgqhy6nl6zq07rnzry8uyh6rtyq0uzgtk3e69fqgtz9l4");
        assert.isDefined(deployIntent.data);

        if (deployIntent.data) {
            assert(checkIfByteArrayStartsWith(deployIntent.data, "upgradeContract@"));

            const expectedGasLimit = 6000000 + 50000 + 1500 * deployIntent.data.length;
            assert.equal(deployIntent.gasLimit.valueOf(), expectedGasLimit);
        }
        assert.equal(deployIntent.value, 0);

        assert.deepEqual(deployIntent, abiDeployIntent);
    });

    function checkIfByteArrayStartsWith(array: Uint8Array, sequence: string) {
        const sequenceBytes = Buffer.from(sequence);

        for (let i = 0; i < sequenceBytes.length; i++) {
            if (sequenceBytes[i] !== array[i]) {
                return false;
            }
        }
        return true;
    }
});
