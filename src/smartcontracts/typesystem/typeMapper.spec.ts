import { assert } from "chai";
import { Type } from "./types";
import { TypeExpressionParser } from "./typeExpressionParser";
import { TypeMapper } from "./typeMapper";
import { BigUIntType, I32Type, U16Type, U32Type, U64Type, U8Type } from "./numerical";
import { BytesType } from "./bytes";
import { AddressType } from "./address";
import { VariadicType } from "./variadic";
import { OptionalType } from "./algebraic";
import { CompositeType } from "./composite";
import { ListType, OptionType } from "./generic";
import { ArrayVecType } from "./genericArray";
import { TupleType } from "./tuple";
import { TokenIdentifierType } from "./tokenIdentifier";

type TypeConstructor = new (...typeParameters: Type[]) => Type;

describe("test mapper", () => {
    let parser = new TypeExpressionParser();
    let mapper = new TypeMapper();

    it("should map primitive types", () => {
        testMapping("u8", U8Type);
        testMapping("u16", U16Type);
        testMapping("u32", U32Type);
        testMapping("u64", U64Type);
        testMapping("BigUint", BigUIntType);
        testMapping("TokenIdentifier", TokenIdentifierType);
    });

    it("should map generic types", () => {
        testMapping("Option<u64>", OptionType, [new U64Type()]);
        testMapping("List<u64>", ListType, [new U64Type()]);
    });

    it("should map variadic types", () => {
        testMapping("VarArgs<u32>", VariadicType, [new U32Type()]);
        testMapping("VarArgs<bytes>", VariadicType, [new BytesType()]);
        testMapping("MultiResultVec<u32>", VariadicType, [new U32Type()]);
        testMapping("MultiResultVec<Address>", VariadicType, [new AddressType()]);
    });

    it("should map complex generic, composite, variadic types", () => {
        testMapping("MultiResultVec<MultiResult<i32,bytes,>>", VariadicType, [
            new CompositeType(new I32Type(), new BytesType()),
        ]);
        testMapping("VarArgs<MultiArg<i32,bytes,>>", VariadicType, [new CompositeType(new I32Type(), new BytesType())]);
        testMapping("OptionalResult<Address>", OptionalType, [new AddressType()]);
    });

    it("should map tuples", () => {
        testMapping("tuple2<u32,bytes>", TupleType, [new U32Type(), new BytesType()]);
        testMapping("tuple2<Address,BigUint>", TupleType, [new AddressType(), new BigUIntType()]);
        testMapping("tuple3<u32, bytes, u64>", TupleType, [new U32Type(), new BytesType(), new U64Type()]);
        //TODO: Rewrite serializer to map more complex objects

        // After improvement enable the following test
        // testMapping("tuple2<tuple3<u32, bytes, u64>, Address>", TupleType, [
        //   new TupleType(new Type("tuple3", [new U32Type(), new BytesType(), new U64Type()])),
        //   new AddressType(),
        // ]);
    });

    it("should map arrays", () => {
        testArrayMapping("array2<BigUint>", 2, new BigUIntType());
        testArrayMapping("array2<u32>", 2, new U32Type());
        testArrayMapping("array8<BigUint>", 8, new BigUIntType());
        testArrayMapping("array256<BigUint>", 256, new BigUIntType());
    });

    function testArrayMapping(expression: string, size: number, typeParameter: Type) {
        let type = parser.parse(expression);
        let mappedType = mapper.mapType(type);

        assert.instanceOf(mappedType, ArrayVecType);
        assert.deepEqual(mappedType, new ArrayVecType(size, typeParameter));
    }

    function testMapping(expression: string, constructor: TypeConstructor, typeParameters: Type[] = []) {
        let type = parser.parse(expression);
        let mappedType = mapper.mapType(type);

        assert.instanceOf(mappedType, constructor);
        assert.deepEqual(mappedType, new constructor(...typeParameters));
    }
});
