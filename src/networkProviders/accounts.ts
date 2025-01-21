import { CodeMetadata } from "../abi";
import { Address } from "../address";

/**
 * A plain view of an account, as queried from the Network.
 */
export class AccountOnNetwork {
    address: Address = Address.empty();
    nonce: bigint = 0n;
    balance: bigint = 0n;
    userName: string = "";

    contractCodeHash?: string;
    contractCode?: Uint8Array;
    contractDeveloperReward?: bigint;
    contractOwnerAddress?: Address;

    isContractUpgradable?: boolean;
    isContractReadable?: boolean;
    isContractPayable?: boolean;
    isContractPayableByContract?: boolean;

    isGuarded: boolean = false;

    constructor(init?: Partial<AccountOnNetwork>) {
        Object.assign(this, init);
    }

    static fromApiHttpResponse(payload: any): AccountOnNetwork {
        const result = new AccountOnNetwork();

        result.address = payload["address"] ? new Address(payload["address"]) : Address.empty();
        result.nonce = BigInt(payload["nonce"] || 0);
        result.balance = BigInt(payload["balance"] || 0);
        result.userName = payload["username"] || undefined;

        result.contractCodeHash = payload["codeHash"] || "";
        result.contractCode = Buffer.from(payload["code"] || "");
        result.contractDeveloperReward = payload["developerReward"] || 0n;
        result.contractOwnerAddress = payload["ownerAddress"] ? new Address(payload["ownerAddress"]) : undefined;
        result.isContractUpgradable = Boolean(payload["isUpgradeable"]);
        result.isContractReadable = Boolean(payload["isReadable"]);
        result.isContractPayable = Boolean(payload["isPayable"]);
        result.isContractPayableByContract = Boolean(payload["isPayableBySmartContract"]);
        result.isGuarded = Boolean(payload["isGuarded"]);
        return result;
    }

    static fromProxyHttpResponse(payload: any): AccountOnNetwork {
        const result = new AccountOnNetwork();

        result.address = payload["address"] ? new Address(payload["address"]) : Address.empty();
        result.nonce = BigInt(payload["nonce"] || 0);
        result.balance = BigInt(payload["balance"] || 0);
        result.userName = payload["username"] || undefined;

        const codeMetadata = payload["codeMetadata"] ?? null;
        result.isContractUpgradable = false;
        result.isContractReadable = false;
        result.isContractPayable = false;
        result.isContractPayableByContract = false;
        if (codeMetadata) {
            const metadataBuffer = Buffer.from(codeMetadata, "base64");
            const metadata = CodeMetadata.newFromBytes(metadataBuffer);
            result.isContractUpgradable = metadata.upgradeable;
            result.isContractReadable = metadata.readable;
            result.isContractPayable = metadata.payable;
            result.isContractPayableByContract = metadata.payableBySc;
        }
        result.contractCodeHash = payload["codeHash"] || "";
        result.contractCode = Buffer.from(payload["code"] || "");
        result.contractDeveloperReward = payload["developerReward"] || 0n;
        result.contractOwnerAddress = payload["ownerAddress"] ? new Address(payload["ownerAddress"]) : undefined;
        result.isGuarded = Boolean(payload["isGuarded"]);
        return result;
    }
}

export class GuardianData {
    guarded: boolean = false;
    activeGuardian?: Guardian;
    pendingGuardian?: Guardian;

    constructor(init?: Partial<GuardianData>) {
        Object.assign(this, init);
    }

    static fromHttpResponse(response: any): GuardianData {
        const result = new GuardianData();

        result.guarded = response["guarded"] || false;

        if (response["activeGuardian"]) {
            result.activeGuardian = Guardian.fromHttpResponse(response["activeGuardian"]);
        }

        if (response["pendingGuardian"]) {
            result.pendingGuardian = Guardian.fromHttpResponse(response["pendingGuardian"]);
        }

        return result;
    }

    getCurrentGuardianAddress(): Address | undefined {
        if (!this.guarded) {
            return undefined;
        }

        return this.activeGuardian?.address;
    }
}

class Guardian {
    activationEpoch: number = 0;
    address: Address = Address.empty();
    serviceUID: string = "";

    static fromHttpResponse(responsePart: any): Guardian {
        const result = new Guardian();

        result.activationEpoch = Number(responsePart["activationEpoch"] || 0);
        result.address = new Address(responsePart["address"] || "");
        result.serviceUID = responsePart["serviceUID"] || "";

        return result;
    }
}
