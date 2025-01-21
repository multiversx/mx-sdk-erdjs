import BigNumber from "bignumber.js";
import { EGLD_IDENTIFIER_FOR_MULTI_ESDTNFT_TRANSFER } from "./constants";
import { ErrInvalidArgument, ErrInvalidTokenIdentifier } from "./errors";
import { numberToPaddedHex } from "./utils.codec";

// Legacy constants:
const EGLDTokenIdentifier = "EGLD";
const EGLDNumDecimals = 18;

// Legacy configuration.
// Note: this will actually set the default rounding mode for all BigNumber objects in the environment (in the application / dApp).
BigNumber.set({ ROUNDING_MODE: 1 });

interface ILegacyTokenTransferOptions {
    tokenIdentifier: string;
    nonce: number;
    amountAsBigInteger: BigNumber.Value;
    numDecimals?: number;
}

export class Token {
    readonly identifier: string;
    readonly nonce: bigint;

    constructor(options: { identifier: string; nonce?: bigint }) {
        this.identifier = options.identifier;
        this.nonce = options.nonce || 0n;
    }
}

export class TokenTransfer {
    readonly token: Token;
    readonly amount: bigint;

    /**
     * Legacy field. Use "token.identifier" instead.
     */
    readonly tokenIdentifier: string;

    /**
     * Legacy field. Use "token.nonce" instead.
     */
    readonly nonce: number;

    /**
     * Legacy field. Use "amount" instead.
     */
    readonly amountAsBigInteger: BigNumber;

    /**
     * Legacy field. The number of decimals is not a concern of "sdk-core".
     * For formatting and parsing amounts, use "sdk-dapp" or "bignumber.js" directly.
     */
    readonly numDecimals: number;

    constructor(options: { token: Token; amount: bigint } | ILegacyTokenTransferOptions) {
        if (this.isLegacyTokenTransferOptions(options)) {
            // Handle legacy fields.
            const amount = new BigNumber(options.amountAsBigInteger);
            if (!amount.isInteger() || amount.isNegative()) {
                throw new ErrInvalidArgument(`bad amountAsBigInteger: ${options.amountAsBigInteger}`);
            }

            this.tokenIdentifier = options.tokenIdentifier;
            this.nonce = options.nonce;
            this.amountAsBigInteger = amount;
            this.numDecimals = options.numDecimals || 0;

            // Handle new fields.
            this.token = new Token({
                identifier: options.tokenIdentifier,
                nonce: BigInt(options.nonce),
            });

            this.amount = BigInt(this.amountAsBigInteger.toFixed(0));
        } else {
            // Handle new fields.
            this.token = options.token;
            this.amount = options.amount;

            // Handle legacy fields.
            this.tokenIdentifier = options.token.identifier;
            this.nonce = Number(options.token.nonce);
            this.amountAsBigInteger = new BigNumber(this.amount.toString());
            this.numDecimals = 0;
        }
    }

    static newFromNativeAmount(amount: bigint): TokenTransfer {
        const token = new Token({ identifier: EGLD_IDENTIFIER_FOR_MULTI_ESDTNFT_TRANSFER });
        return new TokenTransfer({ token, amount });
    }

    private isLegacyTokenTransferOptions(options: any): options is ILegacyTokenTransferOptions {
        return options.tokenIdentifier !== undefined;
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static egldFromAmount(amount: BigNumber.Value) {
        const amountAsBigInteger = new BigNumber(amount).shiftedBy(EGLDNumDecimals).decimalPlaces(0);
        return this.egldFromBigInteger(amountAsBigInteger);
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static egldFromBigInteger(amountAsBigInteger: BigNumber.Value) {
        return new TokenTransfer({
            tokenIdentifier: EGLDTokenIdentifier,
            nonce: 0,
            amountAsBigInteger,
            numDecimals: EGLDNumDecimals,
        });
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static fungibleFromAmount(tokenIdentifier: string, amount: BigNumber.Value, numDecimals: number) {
        const amountAsBigInteger = new BigNumber(amount).shiftedBy(numDecimals).decimalPlaces(0);
        return this.fungibleFromBigInteger(tokenIdentifier, amountAsBigInteger, numDecimals);
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static fungibleFromBigInteger(
        tokenIdentifier: string,
        amountAsBigInteger: BigNumber.Value,
        numDecimals: number = 0,
    ) {
        return new TokenTransfer({
            tokenIdentifier,
            nonce: 0,
            amountAsBigInteger,
            numDecimals,
        });
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static nonFungible(tokenIdentifier: string, nonce: number) {
        return new TokenTransfer({
            tokenIdentifier,
            nonce,
            amountAsBigInteger: 1,
            numDecimals: 0,
        });
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static semiFungible(tokenIdentifier: string, nonce: number, quantity: number) {
        return new TokenTransfer({
            tokenIdentifier,
            nonce,
            amountAsBigInteger: quantity,
            numDecimals: 0,
        });
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static metaEsdtFromAmount(tokenIdentifier: string, nonce: number, amount: BigNumber.Value, numDecimals: number) {
        const amountAsBigInteger = new BigNumber(amount).shiftedBy(numDecimals).decimalPlaces(0);
        return this.metaEsdtFromBigInteger(tokenIdentifier, nonce, amountAsBigInteger, numDecimals);
    }

    /**
     * @deprecated Use the constructor instead: new TokenTransfer({ token, amount });
     */
    static metaEsdtFromBigInteger(
        tokenIdentifier: string,
        nonce: number,
        amountAsBigInteger: BigNumber.Value,
        numDecimals = 0,
    ) {
        return new TokenTransfer({
            tokenIdentifier,
            nonce,
            amountAsBigInteger,
            numDecimals,
        });
    }

    toString() {
        return this.amount.toString();
    }

    /**
     * @deprecated Use the "amount" field instead.
     */
    valueOf(): BigNumber {
        return new BigNumber(this.amount.toString());
    }

    /**
     * @deprecated For formatting and parsing amounts, use "sdk-dapp" or "bignumber.js" directly.
     */
    toPrettyString(): string {
        return `${this.toAmount()} ${this.tokenIdentifier}`;
    }

    private toAmount(): string {
        return this.amountAsBigInteger.shiftedBy(-this.numDecimals).toFixed(this.numDecimals);
    }

    /**
     * @deprecated Within your code, don't mix native values (EGLD) and custom (ESDT) tokens.
     * See "TransferTransactionsFactory.createTransactionForNativeTokenTransfer()" vs. "TransferTransactionsFactory.createTransactionForESDTTokenTransfer()".
     */
    isEgld(): boolean {
        return this.token.identifier == EGLDTokenIdentifier;
    }

    /**
     * @deprecated Use "TokenComputer.isFungible(token)" instead.
     */
    isFungible(): boolean {
        return this.token.nonce == 0n;
    }
}

export class TokenComputer {
    TOKEN_RANDOM_SEQUENCE_LENGTH = 6;
    constructor() {}

    isFungible(token: Token): boolean {
        return token.nonce === 0n;
    }

    extractNonceFromExtendedIdentifier(identifier: string): number {
        const parts = identifier.split("-");

        const { prefix, ticker, randomSequence } = this.splitIdentifierIntoComponents(parts);
        this.validateExtendedIdentifier(prefix, ticker, randomSequence, parts);

        // If identifier is for a fungible token (2 parts or 3 with prefix), return 0
        if (parts.length === 2 || (prefix && parts.length === 3)) {
            return 0;
        }

        // Otherwise, decode the last part as an unsigned number
        const hexNonce = parts[parts.length - 1];
        return decodeUnsignedNumber(Buffer.from(hexNonce, "hex"));
    }

    extractIdentifierFromExtendedIdentifier(identifier: string): string {
        const parts = identifier.split("-");
        const { prefix, ticker, randomSequence } = this.splitIdentifierIntoComponents(parts);

        this.validateExtendedIdentifier(prefix, ticker, randomSequence, parts);
        if (prefix) {
            this.checkLengthOfPrefix(prefix);
            return prefix + "-" + ticker + "-" + randomSequence;
        }
        return ticker + "-" + randomSequence;
    }

    computeExtendedIdentifier(token: Token): string {
        const parts = token.identifier.split("-");
        const { prefix, ticker, randomSequence } = this.splitIdentifierIntoComponents(parts);

        this.validateExtendedIdentifier(prefix, ticker, randomSequence, parts);

        if (token.nonce < 0) {
            throw new Error("The token nonce can't be less than 0");
        }

        if (token.nonce === 0n) {
            return token.identifier;
        }

        const nonceAsHex = numberToPaddedHex(token.nonce);
        return `${token.identifier}-${nonceAsHex}`;
    }

    private validateExtendedIdentifier(
        prefix: string | null,
        ticker: string,
        randomSequence: string,
        parts: string[],
    ): void {
        this.checkIfExtendedIdentifierWasProvided(prefix, parts);
        this.ensureTokenTickerValidity(ticker);
        this.checkLengthOfRandomSequence(randomSequence);
    }

    private splitIdentifierIntoComponents(parts: string[]): { prefix: any; ticker: any; randomSequence: any } {
        if (this.isLowercaseAlphanumeric(parts[0])) {
            return { prefix: parts[0], ticker: parts[1], randomSequence: parts[2] };
        }

        return { prefix: null, ticker: parts[0], randomSequence: parts[1] };
    }

    private checkIfExtendedIdentifierWasProvided(prefix: string | null, tokenParts: string[]): void {
        //  this is for the identifiers of fungible tokens
        const MIN_EXTENDED_IDENTIFIER_LENGTH_IF_SPLITTED = 2;
        //  this is for the identifiers of nft, sft and meta-esdt
        const MAX_EXTENDED_IDENTIFIER_LENGTH_IF_SPLITTED = prefix ? 4 : 3;

        if (
            tokenParts.length < MIN_EXTENDED_IDENTIFIER_LENGTH_IF_SPLITTED ||
            tokenParts.length > MAX_EXTENDED_IDENTIFIER_LENGTH_IF_SPLITTED
        ) {
            throw new ErrInvalidTokenIdentifier("Invalid extended token identifier provided");
        }
    }

    private isLowercaseAlphanumeric(str: string): boolean {
        return /^[a-z0-9]+$/.test(str);
    }

    private checkLengthOfRandomSequence(randomSequence: string): void {
        if (randomSequence.length !== this.TOKEN_RANDOM_SEQUENCE_LENGTH) {
            throw new ErrInvalidTokenIdentifier(
                "The identifier is not valid. The random sequence does not have the right length",
            );
        }
    }

    private checkLengthOfPrefix(prefix: string): void {
        const MAX_TOKEN_PREFIX_LENGTH = 4;
        const MIN_TOKEN_PREFIX_LENGTH = 1;
        if (prefix.length < MIN_TOKEN_PREFIX_LENGTH || prefix.length > MAX_TOKEN_PREFIX_LENGTH) {
            throw new ErrInvalidTokenIdentifier(
                "The identifier is not valid. The prefix does not have the right length",
            );
        }
    }

    private ensureTokenTickerValidity(ticker: string) {
        const MIN_TICKER_LENGTH = 3;
        const MAX_TICKER_LENGTH = 10;

        if (ticker.length < MIN_TICKER_LENGTH || ticker.length > MAX_TICKER_LENGTH) {
            throw new ErrInvalidTokenIdentifier(
                `The token ticker should be between ${MIN_TICKER_LENGTH} and ${MAX_TICKER_LENGTH} characters`,
            );
        }

        if (!ticker.match(/^[a-zA-Z0-9]+$/)) {
            throw new ErrInvalidTokenIdentifier("The token ticker should only contain alphanumeric characters");
        }

        if (!(ticker == ticker.toUpperCase())) {
            throw new ErrInvalidTokenIdentifier("The token ticker should be upper case");
        }
    }
}

function decodeUnsignedNumber(arg: Buffer): number {
    return arg.readUIntBE(0, arg.length);
}
