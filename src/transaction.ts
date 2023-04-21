import { BigNumber } from "bignumber.js";
import { Address } from "./address";
import { Compatibility } from "./compatibility";
import { TRANSACTION_MIN_GAS_PRICE } from "./constants";
import * as errors from "./errors";
import { Hash } from "./hash";
import { IAddress, IChainID, IGasLimit, IGasPrice, INonce, IPlainTransactionObject, ISignature, ITransactionOptions, ITransactionPayload, ITransactionValue, ITransactionVersion } from "./interface";
import { INetworkConfig } from "./interfaceOfNetwork";
import { TransactionOptions, TransactionVersion } from "./networkParams";
import { ProtoSerializer } from "./proto";
import { Signature } from "./signature";
import { TransactionPayload } from "./transactionPayload";
import { guardNotEmpty } from "./utils";

const createTransactionHasher = require("blake2b");
const TRANSACTION_HASH_LENGTH = 32;

/**
 * An abstraction for creating, signing and broadcasting transactions.
 */
export class Transaction {
  /**
   * The nonce of the transaction (the account sequence number of the sender).
   */
  private nonce: INonce;

  /**
   * The value to transfer.
   */
  private value: ITransactionValue;

  /**
   * The address of the sender.
   */
  private sender: IAddress;

  /**
   * The address of the receiver.
   */
  private readonly receiver: IAddress;

  /**
   * The gas price to be used.
   */
  private gasPrice: IGasPrice;

  /**
   * The maximum amount of gas to be consumed when processing the transaction.
   */
  private gasLimit: IGasLimit;

  /**
   * The payload of the transaction.
   */
  private readonly data: ITransactionPayload;

  /**
   * The chain ID of the Network (e.g. "1" for Mainnet).
   */
  private chainID: IChainID;

  /**
   * The version, required by the Network in order to correctly interpret the contents of the transaction.
   * @deprecated Use getVersion() and setVersion() instead.
   */
  version: TransactionVersion = TransactionVersion.withDefaultVersion();

  /**
   * The options field, useful for describing different settings available for transactions
   * @deprecated Use getOptions() and setOptions() instead.
   */
  options: TransactionOptions = TransactionOptions.withDefaultOptions();

  /**
   * The address of the guardian.
   */
  private guardian: IAddress;

  /**
   * The signature.
   */
  private signature: Buffer;

  /**
   * The signature of the guardian.
   */
  private guardianSignature: Buffer;

  /**
   * The transaction hash, also used as a transaction identifier.
   */
  private hash: TransactionHash;

  /**
   * Creates a new Transaction object.
   */
  public constructor({
    nonce,
    value,
    receiver,
    sender,
    gasPrice,
    gasLimit,
    data,
    chainID,
    version,
    options,
    guardian,
  }: {
    nonce?: INonce;
    value?: ITransactionValue;
    receiver: IAddress;
    sender: IAddress;
    gasPrice?: IGasPrice;
    gasLimit: IGasLimit;
    data?: ITransactionPayload;
    chainID: IChainID;
    version?: ITransactionVersion;
    options?: ITransactionOptions;
    guardian?: IAddress;
  }) {
    this.nonce = nonce || 0;
    this.value = value ? new BigNumber(value.toString()).toFixed(0) : 0;
    this.sender = sender;
    this.receiver = receiver;
    this.gasPrice = gasPrice || TRANSACTION_MIN_GAS_PRICE;
    this.gasLimit = gasLimit;
    this.data = data || new TransactionPayload();
    this.chainID = chainID;
    this.guardian = guardian || Address.empty();

    const hasGuardian = guardian?.bech32() ? true : false;
    const defaultVersion = TransactionVersion.withDefaultVersion();
    // Theoretically, the transaction factories should be responsible with setting the correct options.
    // However, for now, since we don't yet provide complete & uniform transaction construction facilities (i.e. factories),
    // we'll handle the "guarded" option here.
    // TODO: Remove this logic once we have complete & uniform transaction construction facilities (i.e. factories).
    const defaultOptions = TransactionOptions.withOptions({ guarded: hasGuardian });

    this.setVersion(version || defaultVersion);
    this.setOptions(options || defaultOptions);

    this.signature = Buffer.from([]);
    this.guardianSignature = Buffer.from([]);
    this.hash = TransactionHash.empty();
  }

  getNonce(): INonce {
    return this.nonce;
  }

  /**
   * Sets the account sequence number of the sender. Must be done prior signing.
   */
  setNonce(nonce: INonce) {
    this.nonce = nonce;
  }

  getValue(): ITransactionValue {
    return this.value;
  }

  setValue(value: ITransactionValue) {
    this.value = value;
  }

  getSender(): IAddress {
    return this.sender;
  }

  setSender(sender: IAddress) {
    this.sender = sender;
  }

  getReceiver(): IAddress {
    return this.receiver;
  }

  getGuardian(): IAddress {
    return this.guardian;
  }

  getGasPrice(): IGasPrice {
    return this.gasPrice;
  }

  setGasPrice(gasPrice: IGasPrice) {
    this.gasPrice = gasPrice;
  }

  getGasLimit(): IGasLimit {
    return this.gasLimit;
  }

  setGasLimit(gasLimit: IGasLimit) {
    this.gasLimit = gasLimit;
  }

  getData(): ITransactionPayload {
    return this.data;
  }

  getChainID(): IChainID {
    return this.chainID;
  }

  setChainID(chainID: IChainID) {
    this.chainID = chainID;
  }

  getVersion(): TransactionVersion {
    return this.version;
  }

  setVersion(version: ITransactionVersion) {
    this.version = new TransactionVersion(version.valueOf());
  }

  getOptions(): TransactionOptions {
    // Make sure that "sdk-core v12" is compatible (for a while) with (older) libraries that were previously setting the (soon to be private) "options" field directly,
    // instead of using the "setOptions()" method.
    const options = new TransactionOptions(this.options.valueOf());
    return options;
  }

  setOptions(options: ITransactionOptions) {
    this.options = new TransactionOptions(options.valueOf());
  }

  getSignature(): Buffer {
    return this.signature;
  }

  getGuardianSignature(): Buffer {
    return this.guardianSignature;
  }

  setGuardian(guardian: IAddress) {
    this.guardian = guardian;
  }

  getHash(): TransactionHash {
    guardNotEmpty(this.hash, "hash");
    return this.hash;
  }

  /**
   * Serializes a transaction to a sequence of bytes, ready to be signed.
   * This function is called internally by signers.
   */
  serializeForSigning(): Buffer {
    // TODO: for appropriate tx.version, interpret tx.options accordingly and sign using the content / data hash
    let plain = this.toPlainObject();
    // Make sure we never sign the transaction with another signature set up (useful when using the same method for verification)
    if (plain.signature) {
      delete plain.signature;
    }

    if (plain.guardianSignature) {
      delete plain.guardianSignature;
    }

    if (!plain.guardian) {
      delete plain.guardian
    }

    let serialized = JSON.stringify(plain);

    return Buffer.from(serialized);
  }

  /**
   * Checks the integrity of the guarded transaction
   */
  isGuardedTransaction(): boolean {
    const hasGuardian = this.guardian.bech32().length > 0;
    const hasGuardianSignature = this.guardianSignature.length > 0;
    return this.getOptions().isWithGuardian() && hasGuardian && hasGuardianSignature;
  }

  /**
   * Converts the transaction object into a ready-to-serialize, plain JavaScript object.
   * This function is called internally within the signing procedure.
   */
  toPlainObject(): IPlainTransactionObject {
    const plainObject = {
      nonce: this.nonce.valueOf(),
      value: this.value.toString(),
      receiver: this.receiver.bech32(),
      sender: this.sender.bech32(),
      gasPrice: this.gasPrice.valueOf(),
      gasLimit: this.gasLimit.valueOf(),
      data: this.data.length() == 0 ? undefined : this.data.encoded(),
      chainID: this.chainID.valueOf(),
      version: this.version.valueOf(),
      options: this.options.valueOf() == 0 ? undefined : this.options.valueOf(),
      guardian: this.guardian?.bech32() ? (this.guardian.bech32() == "" ? undefined : this.guardian.bech32()) : undefined,
      signature: this.signature.toString("hex") ? this.signature.toString("hex") : undefined,
      guardianSignature: this.guardianSignature.toString("hex") ? this.guardianSignature.toString("hex") : undefined,
    };

    Compatibility.guardAddressIsSetAndNonZero(new Address(plainObject.sender), "'sender' of transaction", "pass the actual sender to the Transaction constructor")

    return plainObject;
  }

  /**
   * Converts a plain object transaction into a Transaction Object.
   *
   * @param plainObjectTransaction Raw data of a transaction, usually obtained by calling toPlainObject()
   */
  static fromPlainObject(plainObjectTransaction: IPlainTransactionObject): Transaction {
    const tx = new Transaction({
      nonce: Number(plainObjectTransaction.nonce),
      value: new BigNumber(plainObjectTransaction.value).toFixed(0),
      receiver: Address.fromString(plainObjectTransaction.receiver),
      sender: Address.fromString(plainObjectTransaction.sender),
      guardian: plainObjectTransaction.guardian == undefined ? undefined : Address.fromString(plainObjectTransaction.guardian || ""),
      gasPrice: Number(plainObjectTransaction.gasPrice),
      gasLimit: Number(plainObjectTransaction.gasLimit),
      data: new TransactionPayload(Buffer.from(plainObjectTransaction.data || "", "base64")),
      chainID: String(plainObjectTransaction.chainID),
      version: new TransactionVersion(plainObjectTransaction.version),
      options: plainObjectTransaction.options == undefined ? undefined : new TransactionOptions(plainObjectTransaction.options)
    });

    if (plainObjectTransaction.signature) {
      tx.applySignature(
        new Signature(plainObjectTransaction.signature),
      );
    }

    if (plainObjectTransaction.guardianSignature) {
      tx.applyGuardianSignature(
        new Signature(plainObjectTransaction.guardianSignature)
      );
    }

    return tx;
  }

  /**
   * Applies the signature on the transaction.
   *
   * @param signature The signature, as computed by a signer.
   */
  applySignature(signature: ISignature | Buffer) {
    if (signature instanceof Buffer) {
      this.signature = signature;
    } else {
      this.signature = Buffer.from(signature.hex(), "hex");
    }

    this.hash = TransactionHash.compute(this);
  }

  /**
 * Applies the guardian signature on the transaction.
 *
 * @param guardianSignature The signature, as computed by a signer.
 */
  applyGuardianSignature(guardianSignature: ISignature | Buffer) {
    if (guardianSignature instanceof Buffer) {
      this.guardianSignature = guardianSignature;
    } else {
      this.guardianSignature = Buffer.from(guardianSignature.hex(), "hex");
    }

    this.hash = TransactionHash.compute(this);
  }

  /**
   * Converts a transaction to a ready-to-broadcast object.
   * Called internally by the network provider.
   */
  toSendable(): any {
    return this.toPlainObject();
  }

  /**
   * Computes the current transaction fee based on the {@link NetworkConfig} and transaction properties
   * @param networkConfig {@link NetworkConfig}
   */
  computeFee(networkConfig: INetworkConfig): BigNumber {
    let moveBalanceGas =
      networkConfig.MinGasLimit.valueOf() +
      this.data.length() * networkConfig.GasPerDataByte.valueOf();
    if (moveBalanceGas > this.gasLimit.valueOf()) {
      throw new errors.ErrNotEnoughGas(this.gasLimit.valueOf());
    }

    let gasPrice = new BigNumber(this.gasPrice.valueOf());
    let feeForMove = new BigNumber(moveBalanceGas).multipliedBy(gasPrice);
    if (moveBalanceGas === this.gasLimit.valueOf()) {
      return feeForMove;
    }

    let diff = new BigNumber(this.gasLimit.valueOf() - moveBalanceGas);
    let modifiedGasPrice = gasPrice.multipliedBy(
      new BigNumber(networkConfig.GasPriceModifier.valueOf())
    );
    let processingFee = diff.multipliedBy(modifiedGasPrice);

    return feeForMove.plus(processingFee);
  }
}

/**
 * An abstraction for handling and computing transaction hashes.
 */
export class TransactionHash extends Hash {
  constructor(hash: string) {
    super(hash);
  }

  /**
   * Computes the hash of a transaction.
   */
  static compute(transaction: Transaction): TransactionHash {
    let serializer = new ProtoSerializer();
    let buffer = serializer.serializeTransaction(transaction);
    let hash = createTransactionHasher(TRANSACTION_HASH_LENGTH)
      .update(buffer)
      .digest("hex");
    return new TransactionHash(hash);
  }
}

