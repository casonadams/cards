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
    create_room_with_code(code: string): Promise<IrohRoom>;
    endpoint_id(): string;
    join_room(ticket_str: string): Promise<IrohRoom>;
    join_room_with_code(code: string): Promise<IrohRoom>;
    static spawn(): Promise<IrohNode>;
    static spawn_host(code: string): Promise<IrohNode>;
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
    readonly intounderlyingbytesource_pull: (a: number, b: number) => number;
    readonly intounderlyingbytesource_start: (a: number, b: number) => void;
    readonly intounderlyingbytesource_type: (a: number) => number;
    readonly intounderlyingsink_abort: (a: number, b: number) => number;
    readonly intounderlyingsink_close: (a: number) => number;
    readonly intounderlyingsink_write: (a: number, b: number) => number;
    readonly intounderlyingsource_cancel: (a: number) => void;
    readonly intounderlyingsource_pull: (a: number, b: number) => number;
    readonly irohnode_create_room: (a: number) => number;
    readonly irohnode_create_room_with_code: (a: number, b: number, c: number) => number;
    readonly irohnode_endpoint_id: (a: number, b: number) => void;
    readonly irohnode_join_room: (a: number, b: number, c: number) => number;
    readonly irohnode_join_room_with_code: (a: number, b: number, c: number) => number;
    readonly irohnode_spawn: () => number;
    readonly irohnode_spawn_host: (a: number, b: number) => number;
    readonly irohroom_broadcast: (a: number, b: number, c: number) => number;
    readonly irohroom_take_stream: (a: number, b: number) => void;
    readonly irohroom_ticket: (a: number, b: number) => void;
    readonly irohroom_topic_id: (a: number, b: number) => void;
    readonly wasmcanadiansalad_get_hands: (a: number, b: number) => void;
    readonly wasmcanadiansalad_get_state: (a: number, b: number) => void;
    readonly wasmcanadiansalad_new: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcanadiansalad_play_card: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly wasmcanadiansalad_start_round: (a: number, b: number) => void;
    readonly wasmohwell_get_hands: (a: number, b: number) => void;
    readonly wasmohwell_get_state: (a: number, b: number) => void;
    readonly wasmohwell_new: (a: number, b: number, c: number, d: number) => void;
    readonly wasmohwell_place_bid: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmohwell_play_card: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly wasmohwell_start_round: (a: number, b: number) => void;
    readonly ring_core_0_17_14__bn_mul_mont: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly __wasm_bindgen_func_elem_7493: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_7508: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_2151: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_3551: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_4400: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_3464: (a: number, b: number) => void;
    readonly __wasm_bindgen_func_elem_3934: (a: number, b: number) => void;
    readonly __wasm_bindgen_func_elem_7433: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
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
