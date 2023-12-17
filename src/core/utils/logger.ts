import chalk from "chalk";
import process from "node:process";

export function getHead() {
    const now = new Date()
    return chalk.blackBright(`[${now.toLocaleString()}]`)
}

export function logger(color: (s: string) => string, data: any, type: string) {
    const head = getHead()
    const string = (head) + " " + type + ": " +
        ((typeof data === "string") ? data : Bun.inspect(data, {
            colors: true,
            depth: 5,
            sorted: true
        }));
    // eslint-disable-next-line no-console
    if (string.includes("WARN:")) return console.warn(string)
    // eslint-disable-next-line no-console
    if (string.includes("ERROR:")) return console.warn(string)

    // eslint-disable-next-line no-console
    console.log(string)
}


export const info = (data: any) => logger(chalk.cyan, data, (chalk.green("INFO")))
export const warn = (data: any) => logger(chalk.yellow, data, (chalk.yellow("WARN")))
export const error = (data: any) => logger(chalk.red, data, (chalk.red("ERROR")))