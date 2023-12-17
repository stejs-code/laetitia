export function defer(fn: () => Promise<unknown> | unknown) {
    fn()
}