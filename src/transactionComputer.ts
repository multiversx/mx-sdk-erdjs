import BigNumber from "bignumber.js";
import { Address } from "./address";
import {
    MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS,
    TRANSACTION_OPTIONS_TX_GUARDED,
    TRANSACTION_OPTIONS_TX_HASH_SIGN,
} from "./constants";
import * as errors from "./errors";
import { INetworkConfig } from "./interface";
import { ProtoSerializer } from "./proto";
import { Transaction } from "./transaction";

const createTransactionHasher = require("blake2b");
const createKeccakHash = require("keccak");
const TRANSACTION_HASH_LENGTH = 32;

/**
 * An utilitary class meant to work together with the {@link Transaction} class.
 */
export class TransactionComputer {
    constructor() {}

    computeTransactionFee(
        transaction: { gasPrice: bigint; gasLimit: bigint; data: Uint8Array },
        networkConfig: INetworkConfig,
    ): bigint {
        const moveBalanceGas = BigInt(
            networkConfig.minGasLimit + BigInt(transaction.data.length) * networkConfig.gasPerDataByte,
        );
        if (moveBalanceGas > transaction.gasLimit) {
            throw new errors.ErrNotEnoughGas(parseInt(transaction.gasLimit.toString(), 10));
        }

        const gasPrice = transaction.gasPrice;
        const feeForMove = moveBalanceGas * gasPrice;
        if (moveBalanceGas === transaction.gasLimit) {
            return feeForMove;
        }

        const diff = transaction.gasLimit - moveBalanceGas;
        const modifiedGasPrice = BigInt(
            new BigNumber(gasPrice.toString()).multipliedBy(new BigNumber(networkConfig.gasPriceModifier)).toFixed(0),
        );
        const processingFee = diff * modifiedGasPrice;

        return feeForMove + processingFee;
    }

    computeBytesForSigning(transaction: Transaction): Uint8Array {
        this.ensureValidTransactionFields(transaction);

        const plainTransaction = this.toPlainObject(transaction);
        const serialized = JSON.stringify(plainTransaction);
        return new Uint8Array(Buffer.from(serialized));
    }

    computeBytesForVerifying(transaction: Transaction): Uint8Array {
        const isTxSignedByHash = this.hasOptionsSetForHashSigning(transaction);

        if (isTxSignedByHash) {
            return this.computeHashForSigning(transaction);
        }
        return this.computeBytesForSigning(transaction);
    }

    computeHashForSigning(transaction: Transaction): Uint8Array {
        const plainTransaction = this.toPlainObject(transaction);
        const signable = Buffer.from(JSON.stringify(plainTransaction));
        return createKeccakHash("keccak256").update(signable).digest();
    }

    computeTransactionHash(transaction: Transaction): string {
        const serializer = new ProtoSerializer();
        const buffer = serializer.serializeTransaction(transaction);
        const hash = createTransactionHasher(TRANSACTION_HASH_LENGTH).update(buffer).digest("hex");

        return Buffer.from(hash, "hex").toString("hex");
    }

    hasOptionsSetForGuardedTransaction(transaction: Transaction): boolean {
        return (transaction.options & TRANSACTION_OPTIONS_TX_GUARDED) == TRANSACTION_OPTIONS_TX_GUARDED;
    }

    hasOptionsSetForHashSigning(transaction: Transaction): boolean {
        return (transaction.options & TRANSACTION_OPTIONS_TX_HASH_SIGN) == TRANSACTION_OPTIONS_TX_HASH_SIGN;
    }

    applyGuardian(transaction: Transaction, guardian: Address) {
        if (transaction.version < MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS) {
            transaction.version = MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS;
        }

        transaction.options = transaction.options | TRANSACTION_OPTIONS_TX_GUARDED;
        transaction.guardian = guardian;
    }

    isRelayedV3Transaction(transaction: Transaction) {
        return !transaction.relayer.isEmpty();
    }

    applyOptionsForHashSigning(transaction: Transaction) {
        if (transaction.version < MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS) {
            transaction.version = MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS;
        }
        transaction.options = transaction.options | TRANSACTION_OPTIONS_TX_HASH_SIGN;
    }

    private toPlainObject(transaction: Transaction, withSignature?: boolean) {
        let obj: any = {
            nonce: Number(transaction.nonce),
            value: transaction.value.toString(),
            receiver: transaction.receiver.toBech32(),
            sender: transaction.sender.toBech32(),
            senderUsername: this.toBase64OrUndefined(transaction.senderUsername),
            receiverUsername: this.toBase64OrUndefined(transaction.receiverUsername),
            gasPrice: Number(transaction.gasPrice),
            gasLimit: Number(transaction.gasLimit),
            data: this.toBase64OrUndefined(transaction.data),
        };

        if (withSignature) {
            obj.signature = this.toHexOrUndefined(transaction.signature);
        }

        obj.chainID = transaction.chainID;
        obj.version = transaction.version;
        obj.options = transaction.options ? transaction.options : undefined;
        obj.guardian = transaction.guardian.isEmpty() ? undefined : transaction.guardian.toBech32();
        obj.relayer = transaction.relayer?.isEmpty() ? undefined : transaction.relayer?.toBech32();

        return obj;
    }

    private toHexOrUndefined(value?: Uint8Array) {
        return value && value.length ? Buffer.from(value).toString("hex") : undefined;
    }

    private toBase64OrUndefined(value?: string | Uint8Array) {
        return value && value.length ? Buffer.from(value).toString("base64") : undefined;
    }

    private ensureValidTransactionFields(transaction: Transaction) {
        if (!transaction.chainID.length) {
            throw new errors.ErrBadUsage("The `chainID` field is not set");
        }

        if (transaction.version < MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS) {
            if (this.hasOptionsSetForGuardedTransaction(transaction) || this.hasOptionsSetForHashSigning(transaction)) {
                throw new errors.ErrBadUsage(
                    `Non-empty transaction options requires transaction version >= ${MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS}`,
                );
            }
        }
    }
}
