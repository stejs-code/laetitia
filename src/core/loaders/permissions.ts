import path from "path";
import fs from "fs";
import template from "~/core/loaders/permissions.template.txt"


export async function generatePermissionsFile(permissions: string[]) {
    const lines = new Set<string>

    for (const permission of permissions) {
        lines.add(`    "${permission}": z.boolean().default(false),`)
    }

    const fileContent = template.replace("$$ZOD_ROWS$$", Array.from(lines.values()).join("\n"))

    const pathToFile = path.join(import.meta.dir, "../generated/permissions.ts")
    const fileExists = await fs.promises.exists(pathToFile)

    if (!(fileExists && await Bun.file(pathToFile).text() === fileContent)) {
        await Bun.write(pathToFile, fileContent)
    }
}