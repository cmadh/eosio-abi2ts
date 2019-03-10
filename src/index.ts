import {Declaration} from './abi'
import version from './version'

interface BuiltIn {name: string, type: string}

const builtins: BuiltIn[] = [
    {name: 'asset', type: 'string'},
    {name: 'name', type: 'string'},
    {name: 'bytes', type: 'string | number[] | Uint8Array'},

    {name: 'checksum160', type: 'string'},
    {name: 'checksum256', type: 'string'},
    {name: 'checksum512', type: 'string'},

    {name: 'private_key', type: 'string'},
    {name: 'public_key', type: 'string'},
    {name: 'signature', type: 'string'},

    {name: 'symbol', type: 'string'},
    {name: 'symbol_code', type: 'string'},

    {name: 'time_point', type: 'string'},
    {name: 'time_point_sec', type: 'string'},
    {name: 'block_timestamp_type', type: 'string'},

    {name: 'int8', type: 'number'},
    {name: 'int16', type: 'number'},
    {name: 'int32', type: 'number'},
    {name: 'int64', type: 'number | string'},
    {name: 'int128', type: 'string'},

    {name: 'uint8', type: 'number'},
    {name: 'uint16', type: 'number'},
    {name: 'uint32', type: 'number'},
    {name: 'uint64', type: 'number | string'},
    {name: 'uint128', type: 'string'},

    {name: 'float32', type: 'number'},
    {name: 'float64', type: 'number'},
    {name: 'float128', type: 'string'},
]

function resolveOptional(type: string) {
    let name = type
    let optional = false
    if (name[name.length - 1] === '?') {
        optional = true
        name = name.slice(0, -1)
    }
    return {optional, name}
}

export interface TransformOptions {
    /** Function that is used to format type names, e.g. snake_case to PascalCase. */
    typeFormatter: (type: string) => string
    /** String to use as indentation. */
    indent: string
    /** Whether to export interfaces and types. */
    export: boolean
    /** Namespace wrap exports in, optional. */
    namespace?: string
}

/** Returns typescript typings for given abi. */
export default function transform(abi: Declaration, options: TransformOptions) {
    const {indent, typeFormatter} = options
    const exportPrefix = options.export ? 'export ' : ''
    const usedBuiltins = new Set<BuiltIn>()
    let out: string[] = []
    const resolveType = (type: string) => {
        const {name, optional} = resolveOptional(type)
        const builtin = builtins.find((t) => t.name === name)
        if (builtin) {
            usedBuiltins.add(builtin)
        }
        let rv: string
        switch (name) {
            case 'string':
            case 'string[]':
                rv = name
                break
            case 'bool':
                rv = 'boolean'
                break
            case 'bool[]':
                rv = 'boolean[]'
                break
            default:
                rv = typeFormatter(name)
                break
        }
        if (optional) {
            rv += ' | undefined'
        }
        return rv
    }

    for (const type of abi.types || []) {
        out.push(`${ exportPrefix }type ${ resolveType(type.new_type_name) } = ${ resolveType(type.type) }`)
    }

    for (const variant of abi.variants || []) {
        const types = variant.types.map((t) => `['${ t }', ${ resolveType(t) }]`)
        out.push(`type ${ typeFormatter(variant.name) } = ${ types.join(' | ') }`)
    }

    for (const struct of abi.structs || []) {
        let def = `${ exportPrefix }interface ${ typeFormatter(struct.name) }`
        if (struct.base && struct.base.length > 0) {
            def += ` extends ${ typeFormatter(struct.base) }`
        }
        out.push(def + ' {')
        for (const type of struct.fields) {
            const {name, optional} = resolveOptional(type.type)
            out.push(`${ indent }${ type.name }${ optional ? '?' : '' }: ${ resolveType(name) }`)
        }
        out.push('}')
    }

    // future: add runtime and define interfaces for
    //         interacting with actions and tables

    for (const type of [...usedBuiltins].sort((a, b) => builtins.indexOf(b) - builtins.indexOf(a))) {
        out.splice(1, 0, `${ exportPrefix }type ${ typeFormatter(type.name) } = ${ type.type }`)
    }

    if (options.namespace) {
        out = out.map((line) => indent + line)
        out.unshift(`declare namespace ${ options.namespace } {`)
        out.push('}')
    }

    out.unshift(`// Generated by eosio-abi2ts ${ version } - ${ abi.version }\n`)
    return out
}
