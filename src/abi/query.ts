import { Address } from "../address";
import { ITransactionValue } from "../interface";
import { ArgSerializer } from "./argSerializer";
import { IContractFunction } from "./interface";
import { TypedValue } from "./typesystem";

export class Query {
    caller: Address;
    address: Address;
    func: IContractFunction;
    args: TypedValue[];
    value: ITransactionValue;

    constructor(obj: {
        caller?: Address;
        address: Address;
        func: IContractFunction;
        args?: TypedValue[];
        value?: ITransactionValue;
    }) {
        this.caller = obj.caller || Address.empty();
        this.address = obj.address;
        this.func = obj.func;
        this.args = obj.args || [];
        this.value = obj.value || 0;
    }

    getEncodedArguments(): string[] {
        return new ArgSerializer().valuesToStrings(this.args);
    }
}
