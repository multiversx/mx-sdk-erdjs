import BigNumber from "bignumber.js";
import { ARGUMENTS_SEPARATOR, TRANSACTION_OPTIONS_DEFAULT, TRANSACTION_VERSION_DEFAULT } from "../constants";
import { IAddress, IChainID, IGasLimit, IGasPrice, INonce, ITransactionValue } from "../interface";
import { Logger } from "../logger";
import { TransactionOptions, TransactionVersion } from "../networkParams";
import { Transaction } from "../transaction";
import { TransactionPayload } from "../transactionPayload";
import { addressToHex, bigIntToHex, bufferToHex, utf8ToHex } from "./codec";

interface IConfig {
    chainID: IChainID;
    minGasPrice: IGasPrice;
    minGasLimit: IGasLimit;
    gasLimitPerByte: IGasLimit;
    gasLimitIssue: IGasLimit;
    gasLimitToggleBurnRoleGlobally: IGasLimit;
    gasLimitESDTLocalMint: IGasLimit;
    gasLimitESDTLocalBurn: IGasLimit;
    gasLimitSetSpecialRole: IGasLimit;
    gasLimitPausing: IGasLimit;
    gasLimitFreezing: IGasLimit;
    gasLimitWiping: IGasLimit;
    gasLimitESDTNFTCreate: IGasLimit;
    gasLimitESDTNFTUpdateAttributes: IGasLimit;
    gasLimitESDTNFTAddQuantity: IGasLimit;
    gasLimitESDTNFTBurn: IGasLimit;
    gasLimitStorePerByte: IGasLimit;
    issueCost: BigNumber.Value;
    esdtContractAddress: IAddress;
}

interface IBaseArgs {
    transactionNonce?: INonce;
    value?: ITransactionValue;
    gasPrice?: IGasPrice;
    gasLimit?: IGasLimit;
}

interface IIssueFungibleArgs extends IBaseArgs {
    issuer: IAddress;
    tokenName: string;
    tokenTicker: string;
    initialSupply: BigNumber.Value;
    numDecimals: number;
    canFreeze: boolean;
    canWipe: boolean;
    canPause: boolean;
    canChangeOwner: boolean;
    canUpgrade: boolean;
    canAddSpecialRoles: boolean;
}

interface IIssueSemiFungibleArgs extends IBaseArgs {
    issuer: IAddress;
    tokenName: string;
    tokenTicker: string;
    canFreeze: boolean;
    canWipe: boolean;
    canPause: boolean;
    canTransferNFTCreateRole: boolean;
    canChangeOwner: boolean;
    canUpgrade: boolean;
    canAddSpecialRoles: boolean;
}

interface IIssueNonFungibleArgs extends IIssueSemiFungibleArgs { }

interface IRegisterMetaESDT extends IIssueSemiFungibleArgs {
    numDecimals: number;
}

interface IRegisterAndSetAllRoles extends IBaseArgs {
    issuer: IAddress;
    tokenName: string;
    tokenTicker: string;
    tokenType: RegisterAndSetAllRolesTokenType;
    numDecimals: number;
}

type RegisterAndSetAllRolesTokenType = "NFT" | "SFT" | "META" | "FNG";

interface IToggleBurnRoleGloballyArgs extends IBaseArgs {
    manager: IAddress;
    tokenIdentifier: string;
}

interface IFungibleSetSpecialRoleArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
    addRoleLocalMint: boolean;
    addRoleLocalBurn: boolean;
}

interface ISemiFungibleSetSpecialRoleArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
    addRoleNFTCreate: boolean;
    addRoleNFTBurn: boolean;
    addRoleNFTAddQuantity: boolean;
    addRoleESDTTransferRole: boolean;
}

interface INonFungibleSetSpecialRoleArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
    addRoleNFTCreate: boolean;
    addRoleNFTBurn: boolean;
    addRoleNFTUpdateAttributes: boolean;
    addRoleNFTAddURI: boolean;
    addRoleESDTTransferRole: boolean;
}

interface INFTCreateArgs extends IBaseArgs {
    creator: IAddress;
    tokenIdentifier: string;
    initialQuantity: BigNumber.Value;
    name: string;
    royalties: number;
    hash: string;
    attributes: Buffer;
    uris: string[];
}

interface IPausingArgs extends IBaseArgs {
    manager: IAddress;
    tokenIdentifier: string;
}

interface IFreezingArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
}

interface IWipingArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
}

interface ILocalMintArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
    supplyToMint: BigNumber.Value;
}

interface ILocalBurnArgs extends IBaseArgs {
    manager: IAddress;
    user: IAddress;
    tokenIdentifier: string;
    supplyToBurn: BigNumber.Value;
}

interface IUpdateAttributesArgs extends IBaseArgs {
    manager: IAddress;
    tokenIdentifier: string;
    tokenNonce: BigNumber.Value;
    attributes: Buffer;
}

interface IAddQuantityArgs extends IBaseArgs {
    manager: IAddress;
    tokenIdentifier: string;
    tokenNonce: BigNumber.Value;
    quantityToAdd: BigNumber.Value;
}

interface IBurnQuantityArgs extends IBaseArgs {
    manager: IAddress;
    tokenIdentifier: string;
    tokenNonce: BigNumber.Value;
    quantityToBurn: BigNumber.Value;
}

/**
 * @deprecated Use {@link TokenManagementTransactionsFactory} instead.
 */
export class TokenOperationsFactory {
    private readonly config: IConfig;
    private readonly trueAsHex;
    private readonly falseAsHex;

    constructor(config: IConfig) {
        this.config = config;
        this.trueAsHex = utf8ToHex("true");
        this.falseAsHex = utf8ToHex("false");
    }

    issueFungible(args: IIssueFungibleArgs): Transaction {
        this.notifyAboutUnsettingBurnRoleGlobally();

        const parts = [
            "issue",
            utf8ToHex(args.tokenName),
            utf8ToHex(args.tokenTicker),
            bigIntToHex(args.initialSupply),
            bigIntToHex(args.numDecimals),
            utf8ToHex("canFreeze"),
            args.canFreeze ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canWipe"),
            args.canWipe ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canPause"),
            args.canPause ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canChangeOwner"),
            args.canChangeOwner ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canUpgrade"),
            args.canUpgrade ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canAddSpecialRoles"),
            args.canAddSpecialRoles ? this.trueAsHex : this.falseAsHex
        ];

        return this.createTransaction({
            sender: args.issuer,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            value: this.config.issueCost,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitIssue,
            dataParts: parts,
        });
    }

    private notifyAboutUnsettingBurnRoleGlobally() {
        Logger.info(`
==========
IMPORTANT!
==========
You are about to issue (register) a new token. This will set the role "ESDTRoleBurnForAll" (globally).
Once the token is registered, you can unset this role by calling "unsetBurnRoleGlobally" (in a separate transaction).`);
    }

    issueSemiFungible(args: IIssueSemiFungibleArgs): Transaction {
        this.notifyAboutUnsettingBurnRoleGlobally();

        const parts = [
            "issueSemiFungible",
            utf8ToHex(args.tokenName),
            utf8ToHex(args.tokenTicker),
            utf8ToHex("canFreeze"),
            args.canFreeze ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canWipe"),
            args.canWipe ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canPause"),
            args.canPause ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canTransferNFTCreateRole"),
            args.canTransferNFTCreateRole ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canChangeOwner"),
            args.canChangeOwner ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canUpgrade"),
            args.canUpgrade ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canAddSpecialRoles"),
            args.canAddSpecialRoles ? this.trueAsHex : this.falseAsHex
        ];

        return this.createTransaction({
            sender: args.issuer,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            value: this.config.issueCost,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitIssue,
            dataParts: parts,
        });
    }

    issueNonFungible(args: IIssueNonFungibleArgs): Transaction {
        this.notifyAboutUnsettingBurnRoleGlobally();

        const parts = [
            "issueNonFungible",
            utf8ToHex(args.tokenName),
            utf8ToHex(args.tokenTicker),
            utf8ToHex("canFreeze"),
            args.canFreeze ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canWipe"),
            args.canWipe ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canPause"),
            args.canPause ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canTransferNFTCreateRole"),
            args.canTransferNFTCreateRole ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canChangeOwner"),
            args.canChangeOwner ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canUpgrade"),
            args.canUpgrade ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canAddSpecialRoles"),
            args.canAddSpecialRoles ? this.trueAsHex : this.falseAsHex
        ];

        return this.createTransaction({
            sender: args.issuer,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            value: this.config.issueCost,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitIssue,
            dataParts: parts,
        });
    }

    registerMetaESDT(args: IRegisterMetaESDT): Transaction {
        this.notifyAboutUnsettingBurnRoleGlobally();

        const parts = [
            "registerMetaESDT",
            utf8ToHex(args.tokenName),
            utf8ToHex(args.tokenTicker),
            bigIntToHex(args.numDecimals),
            utf8ToHex("canFreeze"),
            args.canFreeze ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canWipe"),
            args.canWipe ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canPause"),
            args.canPause ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canTransferNFTCreateRole"),
            args.canTransferNFTCreateRole ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canChangeOwner"),
            args.canChangeOwner ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canUpgrade"),
            args.canUpgrade ? this.trueAsHex : this.falseAsHex,
            utf8ToHex("canAddSpecialRoles"),
            args.canAddSpecialRoles ? this.trueAsHex : this.falseAsHex
        ];

        return this.createTransaction({
            sender: args.issuer,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            value: this.config.issueCost,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitIssue,
            dataParts: parts,
        });
    }

    registerAndSetAllRoles(args: IRegisterAndSetAllRoles): Transaction {
        this.notifyAboutUnsettingBurnRoleGlobally();

        const parts = [
            "registerAndSetAllRoles",
            utf8ToHex(args.tokenName),
            utf8ToHex(args.tokenTicker),
            utf8ToHex(args.tokenType),
            bigIntToHex(args.numDecimals),
        ];

        return this.createTransaction({
            sender: args.issuer,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            value: this.config.issueCost,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitIssue,
            dataParts: parts,
        });
    }

    setBurnRoleGlobally(args: IToggleBurnRoleGloballyArgs): Transaction {
        const parts = ["setBurnRoleGlobally", utf8ToHex(args.tokenIdentifier)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitToggleBurnRoleGlobally,
            dataParts: parts,
        });
    }

    unsetBurnRoleGlobally(args: IToggleBurnRoleGloballyArgs): Transaction {
        const parts = ["unsetBurnRoleGlobally", utf8ToHex(args.tokenIdentifier)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitToggleBurnRoleGlobally,
            dataParts: parts,
        });
    }

    setSpecialRoleOnFungible(args: IFungibleSetSpecialRoleArgs): Transaction {
        const parts = [
            "setSpecialRole",
            utf8ToHex(args.tokenIdentifier),
            addressToHex(args.user),
            ...(args.addRoleLocalMint ? [utf8ToHex("ESDTRoleLocalMint")] : []),
            ...(args.addRoleLocalBurn ? [utf8ToHex("ESDTRoleLocalBurn")] : []),
        ];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitSetSpecialRole,
            dataParts: parts,
        });
    }

    setSpecialRoleOnSemiFungible(args: ISemiFungibleSetSpecialRoleArgs): Transaction {
        const parts = [
            "setSpecialRole",
            utf8ToHex(args.tokenIdentifier),
            addressToHex(args.user),
            ...(args.addRoleNFTCreate ? [utf8ToHex("ESDTRoleNFTCreate")] : []),
            ...(args.addRoleNFTBurn ? [utf8ToHex("ESDTRoleNFTBurn")] : []),
            ...(args.addRoleNFTAddQuantity ? [utf8ToHex("ESDTRoleNFTAddQuantity")] : []),
            ...(args.addRoleESDTTransferRole ? [utf8ToHex("ESDTTransferRole")] : []),
        ];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitSetSpecialRole,
            dataParts: parts,
        });
    }

    setSpecialRoleOnMetaESDT(args: ISemiFungibleSetSpecialRoleArgs): Transaction {
        return this.setSpecialRoleOnSemiFungible(args);
    }

    setSpecialRoleOnNonFungible(args: INonFungibleSetSpecialRoleArgs): Transaction {
        const parts = [
            "setSpecialRole",
            utf8ToHex(args.tokenIdentifier),
            addressToHex(args.user),
            ...(args.addRoleNFTCreate ? [utf8ToHex("ESDTRoleNFTCreate")] : []),
            ...(args.addRoleNFTBurn ? [utf8ToHex("ESDTRoleNFTBurn")] : []),
            ...(args.addRoleNFTUpdateAttributes ? [utf8ToHex("ESDTRoleNFTUpdateAttributes")] : []),
            ...(args.addRoleNFTAddURI ? [utf8ToHex("ESDTRoleNFTAddURI")] : []),
            ...(args.addRoleESDTTransferRole ? [utf8ToHex("ESDTTransferRole")] : []),
        ];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitSetSpecialRole,
            dataParts: parts,
        });
    }

    nftCreate(args: INFTCreateArgs): Transaction {
        const parts = [
            "ESDTNFTCreate",
            utf8ToHex(args.tokenIdentifier),
            bigIntToHex(args.initialQuantity),
            utf8ToHex(args.name),
            bigIntToHex(args.royalties),
            utf8ToHex(args.hash),
            bufferToHex(args.attributes),
            ...args.uris.map(utf8ToHex),
        ];

        // Note that the following is an approximation (a reasonable one):
        const nftData = args.name + args.hash + args.attributes + args.uris.join("");
        const storageGasLimit = nftData.length * this.config.gasLimitStorePerByte.valueOf();

        return this.createTransaction({
            sender: args.creator,
            receiver: args.creator,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitESDTNFTCreate.valueOf() + storageGasLimit.valueOf(),
            dataParts: parts,
        });
    }

    pause(args: IPausingArgs): Transaction {
        const parts = ["pause", utf8ToHex(args.tokenIdentifier)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitPausing,
            dataParts: parts,
        });
    }

    unpause(args: IPausingArgs): Transaction {
        const parts = ["unPause", utf8ToHex(args.tokenIdentifier)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitPausing,
            dataParts: parts,
        });
    }

    freeze(args: IFreezingArgs): Transaction {
        const parts = ["freeze", utf8ToHex(args.tokenIdentifier), addressToHex(args.user)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitFreezing,
            dataParts: parts,
        });
    }

    unfreeze(args: IFreezingArgs): Transaction {
        const parts = ["unFreeze", utf8ToHex(args.tokenIdentifier), addressToHex(args.user)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitFreezing,
            dataParts: parts,
        });
    }

    wipe(args: IWipingArgs): Transaction {
        const parts = ["wipe", utf8ToHex(args.tokenIdentifier), addressToHex(args.user)];

        return this.createTransaction({
            sender: args.manager,
            receiver: this.config.esdtContractAddress,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitWiping,
            dataParts: parts,
        });
    }

    localMint(args: ILocalMintArgs): Transaction {
        const parts = ["ESDTLocalMint", utf8ToHex(args.tokenIdentifier), bigIntToHex(args.supplyToMint)];

        return this.createTransaction({
            sender: args.manager,
            receiver: args.manager,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitESDTLocalMint,
            dataParts: parts,
        });
    }

    localBurn(args: ILocalBurnArgs): Transaction {
        const parts = ["ESDTLocalBurn", utf8ToHex(args.tokenIdentifier), bigIntToHex(args.supplyToBurn)];

        return this.createTransaction({
            sender: args.manager,
            receiver: args.manager,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitESDTLocalBurn,
            dataParts: parts,
        });
    }

    updateAttributes(args: IUpdateAttributesArgs): Transaction {
        const parts = [
            "ESDTNFTUpdateAttributes",
            utf8ToHex(args.tokenIdentifier),
            bigIntToHex(args.tokenNonce),
            bufferToHex(args.attributes),
        ];

        return this.createTransaction({
            sender: args.manager,
            receiver: args.manager,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitESDTNFTUpdateAttributes,
            dataParts: parts,
        });
    }

    addQuantity(args: IAddQuantityArgs): Transaction {
        const parts = [
            "ESDTNFTAddQuantity",
            utf8ToHex(args.tokenIdentifier),
            bigIntToHex(args.tokenNonce),
            bigIntToHex(args.quantityToAdd),
        ];

        return this.createTransaction({
            sender: args.manager,
            receiver: args.manager,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitESDTNFTAddQuantity,
            dataParts: parts,
        });
    }

    burnQuantity(args: IBurnQuantityArgs): Transaction {
        const parts = [
            "ESDTNFTBurn",
            utf8ToHex(args.tokenIdentifier),
            bigIntToHex(args.tokenNonce),
            bigIntToHex(args.quantityToBurn),
        ];

        return this.createTransaction({
            sender: args.manager,
            receiver: args.manager,
            nonce: args.transactionNonce,
            gasPrice: args.gasPrice,
            gasLimitHint: args.gasLimit,
            executionGasLimit: this.config.gasLimitESDTNFTBurn,
            dataParts: parts,
        });
    }

    private createTransaction({
        sender,
        receiver,
        nonce,
        value,
        gasPrice,
        gasLimitHint,
        executionGasLimit,
        dataParts,
    }: {
        sender: IAddress;
        receiver: IAddress;
        nonce?: INonce;
        value?: ITransactionValue;
        gasPrice?: IGasPrice;
        gasLimitHint?: IGasLimit;
        executionGasLimit: IGasLimit;
        dataParts: string[];
    }): Transaction {
        const payload = this.buildTransactionPayload(dataParts);
        const gasLimit = gasLimitHint || this.computeGasLimit(payload, executionGasLimit);
        const version = new TransactionVersion(TRANSACTION_VERSION_DEFAULT);
        const options = new TransactionOptions(TRANSACTION_OPTIONS_DEFAULT);

        return new Transaction({
            chainID: this.config.chainID,
            sender: sender,
            receiver: receiver,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce || 0,
            value: value || 0,
            data: payload,
            version: version,
            options: options,
        });
    }

    private buildTransactionPayload(parts: string[]): TransactionPayload {
        const data = parts.join(ARGUMENTS_SEPARATOR);
        return new TransactionPayload(data);
    }

    private computeGasLimit(payload: TransactionPayload, executionGas: IGasLimit): IGasLimit {
        const dataMovementGas =
            this.config.minGasLimit.valueOf() + this.config.gasLimitPerByte.valueOf() * payload.length();
        return dataMovementGas + executionGas.valueOf();
    }
}
