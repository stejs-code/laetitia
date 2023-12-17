export function censor(str: string, fromStart: number = 5) {
    return "*".repeat(fromStart) + str.substring(fromStart)
}