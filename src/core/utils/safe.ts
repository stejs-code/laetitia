export function safe<T, F>(func: () => T, fallback: F): T | F {
    try {
        return func()
    } catch (e) {
        return fallback
    }
}

export async function safeAsync<T, F>(func: () => Promise<T>, fallback: F): Promise<T | F> {
    try {
        return await func()
    } catch (e) {
        return fallback
    }
}