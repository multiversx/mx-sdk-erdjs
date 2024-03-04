import { IAddress } from "../interface";
import { ArgSerializer, CodeMetadata, ContractFunction, EndpointDefinition } from "../smartcontracts";
import { byteArrayToHex, utf8ToHex } from "../utils.codec";
import { CONTRACT_DEPLOY_ADDRESS, VM_TYPE_WASM_VM } from "../constants";
import { NativeSerializer } from "../smartcontracts/nativeSerializer";
import { Err, ErrBadUsage } from "../errors";
import { Address } from "../address";
import { TransactionNextBuilder } from "./transactionNextBuilder";
import { Token, NextTokenTransfer } from "../tokens";
import { TokenTransfersDataBuilder } from "./tokenTransfersDataBuilder";
import { TransactionNext } from "../transaction";

interface Config {
    chainID: string;
    minGasLimit: bigint;
    gasLimitPerByte: bigint;
}

interface Abi {
    constructorDefinition: EndpointDefinition;

    getEndpoint(name: string | ContractFunction): EndpointDefinition;
}

interface TokenComputer {
    isFungible(token: Token): boolean;
}

/**
 * Use this class to create transactions to deploy, call or upgrade a smart contract.
 */
export class SmartContractTransactionsFactory {
    private readonly config: Config;
    private readonly abi?: Abi;
    private readonly tokenComputer: TokenComputer;
    private readonly dataArgsBuilder: TokenTransfersDataBuilder;

    constructor(options: { config: Config; abi?: Abi; tokenComputer: TokenComputer }) {
        this.config = options.config;
        this.abi = options.abi;
        this.tokenComputer = options.tokenComputer;
        this.dataArgsBuilder = new TokenTransfersDataBuilder();
    }

    createTransactionForDeploy(options: {
        sender: IAddress;
        bytecode: Uint8Array;
        gasLimit: bigint;
        args?: any[];
        nativeTransferAmount?: bigint;
        isUpgradeable?: boolean;
        isReadable?: boolean;
        isPayable?: boolean;
        isPayableBySmartContract?: boolean;
    }): TransactionNext {
        const nativeTransferAmount = options.nativeTransferAmount ?? 0n;
        const isUpgradeable = options.isUpgradeable ?? true;
        const isReadable = options.isReadable ?? true;
        const isPayable = options.isPayable ?? false;
        const isPayableBySmartContract = options.isPayableBySmartContract ?? true;
        const args = options.args || [];
        const metadata = new CodeMetadata(isUpgradeable, isReadable, isPayable, isPayableBySmartContract);
        let parts = [byteArrayToHex(options.bytecode), byteArrayToHex(VM_TYPE_WASM_VM), metadata.toString()];
        const preparedArgs = this.argsToDataParts(args, this.abi?.constructorDefinition);
        parts = parts.concat(preparedArgs);

        return new TransactionNextBuilder({
            config: this.config,
            sender: options.sender,
            receiver: Address.fromBech32(CONTRACT_DEPLOY_ADDRESS),
            dataParts: parts,
            gasLimit: options.gasLimit,
            addDataMovementGas: false,
            amount: nativeTransferAmount,
        }).build();
    }

    createTransactionForExecute(options: {
        sender: IAddress;
        contract: IAddress;
        functionName: string;
        gasLimit: bigint;
        args?: any[];
        nativeTransferAmount?: bigint;
        tokenTransfers?: NextTokenTransfer[];
    }): TransactionNext {
        const args = options.args || [];
        const tokenTransfer = options.tokenTransfers || [];
        const nativeTransferAmount = options.nativeTransferAmount ?? 0n;
        const numberOfTokens = tokenTransfer.length;

        if (nativeTransferAmount && numberOfTokens) {
            throw new ErrBadUsage("Can't send both native tokens and custom tokens(ESDT/NFT)");
        }

        let receiver = options.contract;
        let dataParts: string[] = [];

        if (numberOfTokens === 1) {
            const transfer = tokenTransfer[0];

            if (this.tokenComputer.isFungible(transfer.token)) {
                dataParts = this.dataArgsBuilder.buildArgsForESDTTransfer(transfer);
            } else {
                dataParts = this.dataArgsBuilder.buildArgsForSingleESDTNFTTransfer(transfer, receiver);
                receiver = options.sender;
            }
        } else if (numberOfTokens > 1) {
            dataParts = this.dataArgsBuilder.buildArgsForMultiESDTNFTTransfer(receiver, tokenTransfer);
            receiver = options.sender;
        }

        dataParts.push(dataParts.length ? utf8ToHex(options.functionName) : options.functionName);
        dataParts = dataParts.concat(this.argsToDataParts(args, this.abi?.getEndpoint(options.functionName)));

        return new TransactionNextBuilder({
            config: this.config,
            sender: options.sender,
            receiver: receiver,
            dataParts: dataParts,
            gasLimit: options.gasLimit,
            addDataMovementGas: false,
            amount: nativeTransferAmount,
        }).build();
    }

    createTransactionForUpgrade(options: {
        sender: IAddress;
        contract: IAddress;
        bytecode: Uint8Array;
        gasLimit: bigint;
        args?: any[];
        nativeTransferAmount?: bigint;
        isUpgradeable?: boolean;
        isReadable?: boolean;
        isPayable?: boolean;
        isPayableBySmartContract?: boolean;
    }): TransactionNext {
        const nativeTransferAmount = options.nativeTransferAmount ?? 0n;

        const isUpgradeable = options.isUpgradeable ?? true;
        const isReadable = options.isReadable ?? true;
        const isPayable = options.isPayable ?? false;
        const isPayableBySmartContract = options.isPayableBySmartContract ?? true;

        const args = options.args || [];
        const metadata = new CodeMetadata(isUpgradeable, isReadable, isPayable, isPayableBySmartContract);

        let parts = ["upgradeContract", byteArrayToHex(options.bytecode), metadata.toString()];
        const preparedArgs = this.argsToDataParts(args, this.abi?.constructorDefinition);
        parts = parts.concat(preparedArgs);

        return new TransactionNextBuilder({
            config: this.config,
            sender: options.sender,
            receiver: options.contract,
            dataParts: parts,
            gasLimit: options.gasLimit,
            addDataMovementGas: false,
            amount: nativeTransferAmount,
        }).build();
    }

    private argsToDataParts(args: any[], endpoint?: EndpointDefinition): string[] {
        if (endpoint) {
            const typedArgs = NativeSerializer.nativeToTypedValues(args, endpoint);
            return new ArgSerializer().valuesToStrings(typedArgs);
        }

        if (this.areArgsOfTypedValue(args)) {
            return new ArgSerializer().valuesToStrings(args);
        }
        throw new Err("Can't convert args to TypedValues");
    }

    private areArgsOfTypedValue(args: any[]): boolean {
        for (const arg of args) {
            if (!arg.belongsToTypesystem) {
                return false;
            }
        }
        return true;
    }
}
