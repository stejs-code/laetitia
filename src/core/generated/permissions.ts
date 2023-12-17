import {z} from "zod" 
 
export const permissionsZod = z.object({
    "app.api-key.create": z.boolean().default(false),
    "app.api-key.delete": z.boolean().default(false),
    "app.api-key.get": z.boolean().default(false),
    "app.api-key.update": z.boolean().default(false),
    "user.user.create": z.boolean().default(false),
    "user.user.delete": z.boolean().default(false),
    "user.user.get": z.boolean().default(false),
    "user.user.update": z.boolean().default(false),
    "user.user.updateMySelf": z.boolean().default(false),
});

export type Permissions = z.infer<typeof permissionsZod>