import type {z, ZodTypeAny} from "zod";
import {ZodDefault} from "zod";
import {ZodNullable, ZodOptional} from "zod";

export type MergeZodTypes<T extends z.ZodRawShape, Incoming extends z.AnyZodObject, Augmentation extends Incoming["shape"]> = z.ZodObject<z.objectUtil.extendShape<T, Augmentation>, Incoming["_def"]["unknownKeys"], Incoming["_def"]["catchall"]>

export function unwrapZod<ZodType extends ZodTypeAny>(type: ZodType): ZodTypeAny {
    if (type instanceof ZodOptional || type instanceof ZodNullable) {
        return unwrapZod(type.unwrap());
    }

    if (type instanceof ZodDefault) {
        return unwrapZod(type._def.innerType)
    }

    return type
}