import type StatusCode from "status-code-enum";
import {z} from "zod";

export const zApiError = z.object({
    error: z.literal(true),
    message: z.string(),
    type: z.string(),
    details: z.any(),
    status: z.number()
})

export class ApiError extends Error {
    constructor(
        public status: StatusCode,
        public message: string,
        public type?: string,
        public details?: unknown) {
        super(message);
    }

    response() {
        return Response.json(this.json(), {
            status: this.status,
        })
    }

    json() {
        return {
            error: true,
            message: this.message,
            type: this.type,
            details: this.details,
            status: this.status
        }
    }
}