import BigNumber from "bignumber.js";
import { Address } from "../address";
import { Compatibility } from "../compatibility";
import { ErrContractHasNoAddress } from "../errors";
import { IAddress, INonce } from "../interface";
import { Transaction } from "../transaction";
import { guardValueIsSet } from "../utils";
import { bigIntToBuffer } from "./codec/utils";
import { CodeMetadata } from "./codeMetadata";
import { ContractFunction } from "./function";
import { Interaction } from "./interaction";
import { CallArguments, DeployArguments, ISmartContract, QueryArguments, UpgradeArguments } from "./interface";
import { NativeSerializer } from "./nativeSerializer";
import { Query } from "./query";
import { ArwenVirtualMachine, ContractCallPayloadBuilder, ContractDeployPayloadBuilder, ContractUpgradePayloadBuilder } from "./transactionPayloadBuilders";
import { EndpointDefinition, TypedValue } from "./typesystem";
const createKeccakHash = require("keccak");

interface IAbi {
    getEndpoints(): EndpointDefinition[];
    getEndpoint(name: string | ContractFunction): EndpointDefinition;
}

/**
 * An abstraction for deploying and interacting with Smart Contracts.
 */
export class SmartContract implements ISmartContract {
    private address: IAddress = new Address();
    private abi?: IAbi;

    /**
     * This object contains a function for each endpoint defined by the contract.
     * (a bit similar to web3js's "contract.methods").
     */
    public readonly methodsExplicit: { [key: string]: (args?: TypedValue[]) => Interaction } = {};

    /**
     * This object contains a function for each endpoint defined by the contract.
     * (a bit similar to web3js's "contract.methods").
     * 
     * This is an alternative to {@link methodsExplicit}. 
     * Unlike {@link methodsExplicit}, automatic type inference (wrt. ABI) is applied when using {@link methods}.
     */
    public readonly methods: { [key: string]: (args?: any[]) => Interaction } = {};

    /**
     * Create a SmartContract object by providing its address on the Network.
     */
    constructor(options: { address?: IAddress, abi?: IAbi } = {}) {
        this.address = options.address || new Address();
        this.abi = options.abi;

        if (this.abi) {
            this.setupMethods();
        }
    }

    private setupMethods() {
        let contract = this;
        let abi = this.getAbi();

        for (const definition of abi.getEndpoints()) {
            let functionName = definition.name;

            // For each endpoint defined by the ABI, we attach a function to the "methods" and "methodsAuto" objects,
            // a function that receives typed values as arguments
            // and returns a prepared contract interaction.
            this.methodsExplicit[functionName] = function (args?: TypedValue[]) {
                let func = new ContractFunction(functionName);
                let interaction = new Interaction(contract, func, args || []);
                return interaction;
            };

            this.methods[functionName] = function (args?: any[]) {
                let func = new ContractFunction(functionName);
                // Perform automatic type inference, wrt. the endpoint definition:
                let typedArgs = NativeSerializer.nativeToTypedValues(args || [], definition);
                let interaction = new Interaction(contract, func, typedArgs || []);
                return interaction;
            };
        }
    }

    /**
     * Sets the address, as on Network.
     */
    setAddress(address: IAddress) {
        this.address = address;
    }

    /**
     * Gets the address, as on Network.
     */
    getAddress(): IAddress {
        return this.address;
    }

    private getAbi(): IAbi {
        guardValueIsSet("abi", this.abi);
        return this.abi!;
    }

    getEndpoint(name: string | ContractFunction): EndpointDefinition {
        return this.getAbi().getEndpoint(name);
    }

    /**
     * Creates a {@link Transaction} for deploying the Smart Contract to the Network.
     */
    deploy({ deployer, guardian, code, codeMetadata, initArguments, value, gasLimit, gasPrice, chainID }: DeployArguments): Transaction {
        Compatibility.guardAddressIsSetAndNonZero(deployer, "'deployer' of SmartContract.deploy()", "pass the actual address to deploy()");

        codeMetadata = codeMetadata || new CodeMetadata();
        initArguments = initArguments || [];
        value = value || 0;

        let payload = new ContractDeployPayloadBuilder()
            .setCode(code)
            .setCodeMetadata(codeMetadata)
            .setInitArgs(initArguments)
            .build();

        let transaction = new Transaction({
            receiver: Address.Zero(),
            sender: deployer,
            guardian: guardian,
            value: value,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            data: payload,
            chainID: chainID
        });

        return transaction;
    }

    /**
     * Creates a {@link Transaction} for upgrading the Smart Contract on the Network.
     */
    upgrade({ caller, guardian, code, codeMetadata, initArguments, value, gasLimit, gasPrice, chainID }: UpgradeArguments): Transaction {
        Compatibility.guardAddressIsSetAndNonZero(caller, "'caller' of SmartContract.upgrade()", "pass the actual address to upgrade()");

        this.ensureHasAddress();

        codeMetadata = codeMetadata || new CodeMetadata();
        initArguments = initArguments || [];
        value = value || 0;

        let payload = new ContractUpgradePayloadBuilder()
            .setCode(code)
            .setCodeMetadata(codeMetadata)
            .setInitArgs(initArguments)
            .build();

        let transaction = new Transaction({
            sender: caller,
            receiver: this.getAddress(),
            guardian: guardian,
            value: value,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            data: payload,
            chainID: chainID
        });

        return transaction;
    }

    /**
     * Creates a {@link Transaction} for calling (a function of) the Smart Contract.
     */
    call({ caller, guardian, func, args, value, gasLimit, receiver, gasPrice, chainID }: CallArguments): Transaction {
        Compatibility.guardAddressIsSetAndNonZero(caller, "'caller' of SmartContract.call()", "pass the actual address to call()");

        this.ensureHasAddress();

        args = args || [];
        value = value || 0;

        let payload = new ContractCallPayloadBuilder()
            .setFunction(func)
            .setArgs(args)
            .build();

        let transaction = new Transaction({
            sender: caller,
            receiver: receiver ? receiver : this.getAddress(),
            guardian: guardian,
            value: value,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            data: payload,
            chainID: chainID,
        });

        return transaction;
    }

    createQuery({ func, args, value, caller }: QueryArguments): Query {
        this.ensureHasAddress();

        return new Query({
            address: this.getAddress(),
            func: func,
            args: args,
            value: value,
            caller: caller
        });
    }

    private ensureHasAddress() {
        if (!this.getAddress().bech32()) {
            throw new ErrContractHasNoAddress();
        }
    }

    /**
     * Computes the address of a Smart Contract. 
     * The address is computed deterministically, from the address of the owner and the nonce of the deployment transaction.
     * 
     * @param owner The owner of the Smart Contract
     * @param nonce The owner nonce used for the deployment transaction
     */
    static computeAddress(owner: IAddress, nonce: INonce): IAddress {
        let initialPadding = Buffer.alloc(8, 0);
        let ownerPubkey = new Address(owner.bech32()).pubkey();
        let shardSelector = ownerPubkey.slice(30);
        let ownerNonceBytes = Buffer.alloc(8);

        const bigNonce = new BigNumber(nonce.valueOf().toString(10));
        const bigNonceBuffer = bigIntToBuffer(bigNonce);
        ownerNonceBytes.write(bigNonceBuffer.reverse().toString('hex'), 'hex');

        let bytesToHash = Buffer.concat([ownerPubkey, ownerNonceBytes]);
        let hash = createKeccakHash("keccak256").update(bytesToHash).digest();
        let vmTypeBytes = Buffer.from(ArwenVirtualMachine, "hex");
        let addressBytes = Buffer.concat([
            initialPadding,
            vmTypeBytes,
            hash.slice(10, 30),
            shardSelector
        ]);

        let address = new Address(addressBytes);
        return address;
    }
}
