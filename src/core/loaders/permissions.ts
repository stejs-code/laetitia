import path from "path";
import fs from "fs";

export async function generatePermissionsFile(permissions: string[]) {
    const lines = new Set<string>

    for (const permission of permissions) {
        lines.add(`    "${permission}": z.boolean().default(false),`)
    }

    // language=TS
    const fileContent = 'import {z} from "zod" \n \n' +
        'export const permissionsZod = z.object({\n' +
        Array.from(lines.values()).join("\n") +
        '\n});\n\n' +
        'export type Permissions = z.infer<typeof permissionsZod>'


    const pathToFile = path.join(import.meta.dir, "../generated/permissions.ts")
    const fileExists = await fs.promises.exists(pathToFile)

    if (!(fileExists && await Bun.file(pathToFile).text() === fileContent)) {
        await Bun.write(pathToFile, fileContent)
    }
}