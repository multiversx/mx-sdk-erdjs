import BigNumber from "bignumber.js";
import { Address } from "../address";

export class PairOnNetwork {
    address: Address = Address.empty();
    id: string = "";
    symbol: string = "";
    name: string = "";
    price: BigNumber = new BigNumber(0);
    baseId: string = "";
    basePrice: BigNumber = new BigNumber(0);
    baseSymbol: string = "";
    baseName: string = "";
    quoteId: string = "";
    quotePrice: BigNumber = new BigNumber(0);
    quoteSymbol: string = "";
    quoteName: string = "";
    totalValue: BigNumber = new BigNumber(0);
    volume24h: BigNumber = new BigNumber(0);
    state: string = "";
    type: string = "";

    rawResponse: any = {};

    constructor(init?: Partial<PairOnNetwork>) {
        Object.assign(this, init);
    }

    static fromApiHttpResponse(payload: any): PairOnNetwork {
        const result = new PairOnNetwork();

        result.address = new Address(payload.address || "");
        result.id = payload.id || "";
        result.symbol = payload.symbol || "";
        result.name = payload.name || "";
        result.price = new BigNumber(payload.price || 0);
        result.baseId = payload.baseId || "";
        result.basePrice = new BigNumber(payload.basePrice || 0);
        result.baseSymbol = payload.baseSymbol || "";
        result.baseName = payload.baseName || "";
        result.quoteId = payload.quoteId || "";
        result.quotePrice = new BigNumber(payload.quotePrice || 0);
        result.quoteSymbol = payload.quoteSymbol || "";
        result.quoteName = payload.quoteName || "";
        result.totalValue = new BigNumber(payload.totalValue || 0);
        result.volume24h = new BigNumber(payload.volume24h || 0);
        result.state = payload.state || "";
        result.type = payload.type || "";

        result.rawResponse = payload;

        return result;
    }
}
