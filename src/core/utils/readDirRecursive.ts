import {readdir} from "fs/promises";
import * as path from "path";

/**
 * @param dir start directory
 * @param baseDir for beauty purposes, ignore
 */
export async function readDirRecursive(dir: string, baseDir?: string): Promise<string[]> {
    const dirs = await readdir(dir, {withFileTypes: true});
    return Array.prototype.concat(...await Promise.all(dirs.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory()
            ? await readDirRecursive(res, baseDir ?? dir)
            : res.substring((baseDir ?? dir).length + ((baseDir ?? dir).endsWith("/") ? 0 : 1));
    })));
}
