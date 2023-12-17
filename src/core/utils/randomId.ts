export function randomId(length: number = 20) {
    const letters = "ABCDEFGHIJKLMNOPQRSTVWXYZabcdefghijklmnopqrtvwxyz0123456789".split("")

    let id = ""
    for (let i = 0; i < length; i++) {
        id += letters[Math.floor(Math.random()*letters.length)]
    }

    return id
}