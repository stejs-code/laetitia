export type PermissionsDefinition = string | string[] | (string[] | string)[]

export const PermissionsSet = new Set<string>()

export class Permissions {
    required: string[]
    optional: string[]

    /**
     *
     * @param def
     * @param prefix e. g. user.group
     */
    constructor(def: PermissionsDefinition, public prefix?: string) {
        if (typeof def === "string") {
            this.required = [def]
            this.optional = []
        } else {
            this.required = []
            this.optional = []
            def.forEach((item) => {
                if (typeof item === "string") return this.required.push(item)

                this.optional.push(...item)
            })
        }

        this.required = this.required.map((item) => {
            if (item.startsWith("@")) return item

            return prefix + "." + item
        })

        this.optional = this.optional.map((item) => {
            if (item.startsWith("@")) return item

            return prefix + "." + item
        })

    }

}