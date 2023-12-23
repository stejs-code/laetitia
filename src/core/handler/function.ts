import {Dependencies, HandlerFunction, InjectList} from "~/core/handler/handler.ts";
import {ApiContext} from "~/core/handler/apiContext.ts";
import {MaybePromise} from "~/core/utils/types.ts";

export class ServerFunction<Props extends Record<string, any>, Return, Injections extends InjectList> {


    getInjections: () => (Injections | Promise<Injections>)

    constructor(
        private func: (props: Props, injects: Dependencies<Injections>) => Return,
        getInjections: Injections | (() => (Injections | Promise<Injections>)) = {} as Injections,
    ) {
        this.getInjections = typeof getInjections === "function" ? getInjections : () => getInjections
    }


    prepare(ctx: ApiContext): (props: Props) => MaybePromise<Return> {
        return async (props: Props) => {
            const injections = await this.getInjections();
            const dependencies: Partial<Dependencies<Injections>> = {}

            for (const key in injections) {
                // It works, so leave it like that
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                dependencies[key] = injections[key].prepare(ctx)
            }

            return this.func(
                props,
                dependencies as Dependencies<Injections>
            );
        }
    }
}
