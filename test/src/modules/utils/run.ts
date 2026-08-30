export const runTest = async (name: string, fn: () => void | Promise<void>) => {
  try {
    const result = fn()
    if (result instanceof Promise) await result
    console.log(`  ✅ ${name}`)
  } catch (e: any) {
    console.error(`  ❌ ${name}`)
    console.error(`     ${e.message}`)
    process.exit(1)
  }
}


