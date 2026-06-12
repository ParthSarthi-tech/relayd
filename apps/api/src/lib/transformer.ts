import { spawn } from 'node:child_process'

export interface TransformInput {
  payload: Record<string, unknown>
  headers: Record<string, string>
}

export interface TransformOutput {
  payload: Record<string, unknown>
  headers: Record<string, string>
}

const TIMEOUT_MS = 1000

const WORKER = [
  'import vm from "node:vm"',
  '',
  `const TIMEOUT = ${TIMEOUT_MS}`,
  '',
  'let body = ""',
  'process.stdin.setEncoding("utf-8")',
  'process.stdin.on("data", (chunk) => { body += chunk })',
  'process.stdin.on("end", () => {',
  '  try {',
  '    const { code, input } = JSON.parse(body)',
  '',
  '    const wrappedCode = [',
  '      "(function() {",',
  '      code,',
  '      "if (typeof transform !== "function") {",',
  '      "throw new Error(\'Transformation must export a "transform" function\')",',
  '      "}",',
  '      "return transform",',
  '      "})()"',
  '    ].join("\\n")',
  '',
  '    const sandbox = {',
  '      console: {',
  '        log: (...args) => process.stderr.write(args.join(" ") + "\\n"),',
  '        warn: (...args) => process.stderr.write(args.join(" ") + "\\n"),',
  '        error: (...args) => process.stderr.write(args.join(" ") + "\\n"),',
  '      },',
  '      JSON, Math, Date, RegExp,',
  '      String, Number, Boolean, Array,',
  '      Object: { keys: Object.keys, values: Object.values, entries: Object.entries, assign: Object.assign },',
  '      Map, Set,',
  '      parseInt, parseFloat, isNaN, isFinite,',
  '      encodeURI, encodeURIComponent, decodeURI, decodeURIComponent,',
  '    }',
  '',
  '    const context = vm.createContext(sandbox)',
  '    const script = new vm.Script(wrappedCode)',
  '    const transformFn = script.runInContext(context, { timeout: TIMEOUT })',
  '',
  '    if (typeof transformFn !== "function") {',
  '      throw new Error("Transformation did not define a \\"transform\\" function")',
  '    }',
  '',
  '    const result = transformFn(input.payload, input.headers)',
  '',
  '    if (!result || typeof result.payload !== "object" || typeof result.headers !== "object") {',
  '      throw new Error("Transform function must return { payload, headers } with object values")',
  '    }',
  '',
  '    process.stdout.write(JSON.stringify({',
  '      success: true,',
  '      output: {',
  '        payload: result.payload ?? input.payload,',
  '        headers: result.headers ?? input.headers,',
  '      },',
  '    }))',
  '  } catch (err) {',
  '    process.stdout.write(JSON.stringify({',
  '      success: false,',
  '      error: err instanceof Error ? err.message : String(err),',
  '    }))',
  '  }',
  '})',
].join('\n')

export async function runTransformation(
  code: string,
  input: TransformInput,
): Promise<TransformOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', WORKER], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: TIMEOUT_MS + 500,
      env: { NODE_OPTIONS: '' },
    })

    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf-8')
    child.stderr.setEncoding('utf-8')
    child.stdout.on('data', (d: string) => {
      stdout += d
    })
    child.stderr.on('data', (d: string) => {
      stderr += d
    })

    child.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(`Transformer worker error: ${err.message}`))
    })

    child.on('exit', (exitCode: number | null, signal: string | null) => {
      if (signal) {
        reject(new Error('Transformation timed out'))
        return
      }
      try {
        const parsed = JSON.parse(stdout)
        if (!parsed.success) {
          reject(new Error(parsed.error || 'Transformation failed'))
          return
        }
        resolve(parsed.output as TransformOutput)
      } catch {
        reject(new Error(stderr ? `Transformer error: ${stderr}` : 'Transformation failed'))
      }
    })

    child.stdin.write(JSON.stringify({ code, input }))
    child.stdin.end()
  })
}
