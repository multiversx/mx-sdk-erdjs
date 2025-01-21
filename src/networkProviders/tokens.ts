import { BigNumber } from "bignumber.js";
import { Address } from "../address";
import { numberToPaddedHex } from "../utils.codec";

export class FungibleTokenOfAccountOnNetwork {
    identifier: string = "";
    balance: BigNumber = new BigNumber(0);
    rawResponse: any = {};

    static fromHttpResponse(payload: any): FungibleTokenOfAccountOnNetwork {
        let result = new FungibleTokenOfAccountOnNetwork();

        result.identifier = payload.tokenIdentifier || payload.identifier || "";
        result.balance = new BigNumber(payload.balance || 0);
        result.rawResponse = payload;

        return result;
    }
}

export class NonFungibleTokenOfAccountOnNetwork {
    identifier: string = "";
    collection: string = "";
    timestamp: number = 0;
    attributes: Buffer = Buffer.from([]);
    nonce: number = 0;
    type: string = "";
    name: string = "";
    creator: Address = Address.empty();
    supply: BigNumber = new BigNumber(0);
    decimals: number = 0;
    royalties: BigNumber = new BigNumber(0);
    assets: string[] = [];
    balance: BigNumber = new BigNumber(0);

    constructor(init?: Partial<NonFungibleTokenOfAccountOnNetwork>) {
        Object.assign(this, init);
    }

    static fromProxyHttpResponse(payload: any): NonFungibleTokenOfAccountOnNetwork {
        const result = NonFungibleTokenOfAccountOnNetwork.fromHttpResponse(payload);

        result.identifier = payload.tokenIdentifier || "";
        result.collection = NonFungibleTokenOfAccountOnNetwork.parseCollectionFromIdentifier(result.identifier);
        result.royalties = new BigNumber(payload.royalties || 0).div(100);

        return result;
    }

    static fromProxyHttpResponseByNonce(payload: any): NonFungibleTokenOfAccountOnNetwork {
        const result = NonFungibleTokenOfAccountOnNetwork.fromHttpResponse(payload);
        let nonceAsHex = numberToPaddedHex(result.nonce);

        result.identifier = `${payload.tokenIdentifier}-${nonceAsHex}`;
        result.collection = payload.tokenIdentifier || "";
        result.royalties = new BigNumber(payload.royalties || 0).div(100);

        return result;
    }

    static fromApiHttpResponse(payload: any): NonFungibleTokenOfAccountOnNetwork {
        const result = NonFungibleTokenOfAccountOnNetwork.fromHttpResponse(payload);

        result.identifier = payload.identifier || "";
        result.collection = payload.collection || "";

        return result;
    }

    // TODO: Compare results from Proxy and API and try to reconciliate them.
    private static fromHttpResponse(payload: any): NonFungibleTokenOfAccountOnNetwork {
        let result = new NonFungibleTokenOfAccountOnNetwork();

        result.timestamp = Number(payload.timestamp || 0);
        result.attributes = Buffer.from(payload.attributes || "", "base64");
        result.nonce = payload.nonce || 0;
        result.type = payload.type || "";
        result.name = payload.name || "";
        result.creator = new Address(payload.creator || "");
        result.decimals = Number(payload.decimals || 0);
        result.supply = new BigNumber(payload.balance || 1);
        result.royalties = new BigNumber(payload.royalties || 0);
        result.assets = payload.assets || [];
        result.balance = new BigNumber(payload.balance || 1);

        return result;
    }

    private static parseCollectionFromIdentifier(identifier: string): string {
        let parts = identifier.split("-");
        let collection = parts.slice(0, 2).join("-");
        return collection;
    }
}
