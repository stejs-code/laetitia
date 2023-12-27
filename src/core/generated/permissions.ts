import {z} from "zod";

export const permissionsZod = z.object({
    "app.session.create": z.boolean().default(false),
    "app.session.delete": z.boolean().default(false),
    "app.session.get": z.boolean().default(false),
    "app.session.login": z.boolean().default(false),
    "app.session.update": z.boolean().default(false),
    "app.api-key.create": z.boolean().default(false),
    "app.api-key.delete": z.boolean().default(false),
    "app.api-key.get": z.boolean().default(false),
    "app.api-key.update": z.boolean().default(false),
    "user.group.create": z.boolean().default(false),
    "user.group.delete": z.boolean().default(false),
    "user.group.get": z.boolean().default(false),
    "user.group.update": z.boolean().default(false),
    "user.user.create": z.boolean().default(false),
    "user.user.delete": z.boolean().default(false),
    "user.user.get": z.boolean().default(false),
    "user.user.update": z.boolean().default(false),
    "user.user.updateMySelf": z.boolean().default(false),
});

export type PermissionsType = z.infer<typeof permissionsZod>

export const allTruePermissions = Object.fromEntries(
    Object.entries(permissionsZod.parse({})).map(([k]) => ([k, true]))
) as {[key in keyof PermissionsType]: true}
