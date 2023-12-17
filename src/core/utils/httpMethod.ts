export const httpMethod = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
] as const

export type HttpMethod = typeof httpMethod[number]