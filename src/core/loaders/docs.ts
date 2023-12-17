import type {PureHandler} from "~/core/handler/pureHandler.ts";
import type {OpenAPI3} from "openapi-typescript";
import path from "path";
import fs from "fs";
import template from "~/openApiTemplate.json";


export async function generateDocs(handlers: Map<string, { handler: PureHandler<any>, path: string }>, version: string) {
    const openApi: OpenAPI3 = template as OpenAPI3
    openApi.info.version = version

    for (const handler of handlers.values()) {

        openApi.paths ??= {}
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        openApi.paths[handler.path] ??= {};
        openApi.paths[handler.path as any][handler.handler.method.toLowerCase() as any] = handler.handler.options.schema
    }

    const pathToFile = path.join(import.meta.dir, "../generated/open-api.json")
    const fileExists = await fs.promises.exists(pathToFile)
    const fileContent = JSON.stringify(openApi)

    if (!(fileExists && await Bun.file(pathToFile).text() === fileContent)) {
        await Bun.write(pathToFile, fileContent)
    }
}