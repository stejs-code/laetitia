import type {z} from "zod";

export type MergeZodTypes<T extends z.ZodRawShape, Incoming extends z.AnyZodObject, Augmentation extends Incoming["shape"]> = z.ZodObject<z.objectUtil.extendShape<T, Augmentation>, Incoming["_def"]["unknownKeys"], Incoming["_def"]["catchall"]>