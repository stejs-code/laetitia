import {isNumber, isObject, isString} from "lodash";
import type {ZodTypeAny, z, ZodOptional} from "zod";
import {ZodArray, ZodBoolean, ZodNumber, ZodObject, ZodString} from "zod";

export function getEmptyEquivalent(type: unknown): unknown {
    if (Array.isArray(type)) return []
    if (isObject(type)) return {}
    if (isString(type)) return ""
    if (isNumber(type)) return 0
    if (typeof type === "boolean") return false
    return ""
}


export function getEmptyEquivalentZod(type: ZodTypeAny): unknown {
    if ("defaultValue" in type._def) return type._def.defaultValue()

    const baseType = ("unwrap" in type) ? (type as ZodOptional<z.ZodAny>).unwrap() : type

    if (baseType instanceof ZodString) return ""
    if (baseType instanceof ZodNumber) return 0
    if (baseType instanceof ZodBoolean) return false
    if (baseType instanceof ZodArray) return []
    if (baseType instanceof ZodObject) {
        const returnVal: Record<string, unknown> = {}
        for (const key in baseType.shape) {
            returnVal[key] = getEmptyEquivalentZod(baseType.shape[key])
        }

        return returnVal
    }

    return ""
}