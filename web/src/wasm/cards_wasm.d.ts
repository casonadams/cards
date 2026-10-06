/* tslint:disable */
/* eslint-disable */
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */

export type ReadableStreamType = "bytes";

export class IntoUnderlyingByteSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableByteStreamController): Promise<any>;
    start(controller: ReadableByteStreamController): void;
    readonly autoAllocateChunkSize: number;
    readonly type: ReadableStreamType;
}

export class IntoUnderlyingSink {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    abort(reason: any): Promise<any>;
    close(): Promise<any>;
    write(chunk: any): Promise<any>;
}

export class IntoUnderlyingSource {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    cancel(): void;
    pull(controller: ReadableStreamDefaultController): Promise<any>;
}

export class IrohNode {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    create_room(): Promise<IrohRoom>;
    endpoint_id(): string;
    join_room(ticket_str: string): Promise<IrohRoom>;
    static spawn(): Promise<IrohNode>;
}

export class IrohRoom {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    broadcast(payload: string): Promise<void>;
    take_stream(): ReadableStream;
    ticket(): string;
    topic_id(): string;
}

export class WasmCanadianSalad {
    free(): void;
    [Symbol.dispose](): void;
    get_hands(): any;
    get_state(): any;
    constructor(player_ids: string[], seed: number);
    play_card(player_id: string, suit: string, rank: number): void;
    start_round(round_index: number): void;
}

export class WasmOhWell {
    free(): void;
    [Symbol.dispose](): void;
    get_hands(): any;
    get_state(): any;
    constructor(player_ids: string[], seed: number);
    place_bid(player_id: string, bid: number): void;
    play_card(player_id: string, suit: string, rank: number): void;
    start_round(round_index: number): void;
}

export function init(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_intounderlyingbytesource_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsink_free: (a: number, b: number) => void;
    readonly __wbg_intounderlyingsource_free: (a: number, b: number) => void;
    readonly __wbg_irohnode_free: (a: number, b: number) => void;
    readonly __wbg_irohroom_free: (a: number, b: number) => void;
    readonly __wbg_wasmcanadiansalad_free: (a: number, b: number) => void;
    readonly __wbg_wasmohwell_free: (a: number, b: number) => void;
    readonly init: () => void;
    readonly intounderlyingbytesource_autoAllocateChunkSize: (a: number) => number;
    readonly intounderlyingbytesource_cancel: (a: number) => void;
    readonly intounderlyingbytesource_pull: (a: number, b: any) => any;
    readonly intounderlyingbytesource_start: (a: number, b: any) => void;
    readonly intounderlyingbytesource_type: (a: number) => number;
    readonly intounderlyingsink_abort: (a: number, b: any) => any;
    readonly intounderlyingsink_close: (a: number) => any;
    readonly intounderlyingsink_write: (a: number, b: any) => any;
    readonly intounderlyingsource_cancel: (a: number) => void;
    readonly intounderlyingsource_pull: (a: number, b: any) => any;
    readonly irohnode_create_room: (a: number) => any;
    readonly irohnode_endpoint_id: (a: number) => [number, number];
    readonly irohnode_join_room: (a: number, b: number, c: number) => any;
    readonly irohnode_spawn: () => any;
    readonly irohroom_broadcast: (a: number, b: number, c: number) => any;
    readonly irohroom_take_stream: (a: number) => [number, number, number];
    readonly irohroom_ticket: (a: number) => [number, number, number, number];
    readonly irohroom_topic_id: (a: number) => [number, number];
    readonly wasmcanadiansalad_get_hands: (a: number) => [number, number, number];
    readonly wasmcanadiansalad_get_state: (a: number) => [number, number, number];
    readonly wasmcanadiansalad_new: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmcanadiansalad_play_card: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wasmcanadiansalad_start_round: (a: number, b: number) => void;
    readonly wasmohwell_get_hands: (a: number) => [number, number, number];
    readonly wasmohwell_get_state: (a: number) => [number, number, number];
    readonly wasmohwell_new: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmohwell_place_bid: (a: number, b: number, c: number, d: number) => [number, number];
    readonly wasmohwell_play_card: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wasmohwell_start_round: (a: number, b: number) => void;
    readonly ring_core_0_17_14__bn_mul_mont: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke___js_sys_c1cdea9cb73db2cb___Function_fn_wasm_bindgen_af0a6d80e30f3f9b___JsValue_____wasm_bindgen_af0a6d80e30f3f9b___sys__Undefined___js_sys_c1cdea9cb73db2cb___Function_fn_wasm_bindgen_af0a6d80e30f3f9b___JsValue_____wasm_bindgen_af0a6d80e30f3f9b___sys__Undefined_______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke___wasm_bindgen_af0a6d80e30f3f9b___JsValue__core_9b3796e30d99ddb7___result__Result_____wasm_bindgen_af0a6d80e30f3f9b___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke___wasm_bindgen_af0a6d80e30f3f9b___JsValue______true_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke___web_sys_b07ec25362304f24___features__gen_CloseEvent__CloseEvent______true_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke___web_sys_b07ec25362304f24___features__gen_MessageEvent__MessageEvent______true_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke_______true_: (a: number, b: number) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke_______true__1_: (a: number, b: number) => void;
    readonly wasm_bindgen_af0a6d80e30f3f9b___convert__closures_____invoke_______true__2_: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
