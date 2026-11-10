/** Bounds SDK waits as well as HTTP waits; a late result cannot replace the timeout. */
export function withDeadline<T>(request: PromiseLike<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), milliseconds)
    Promise.resolve(request).then(resolve, reject).finally(() => clearTimeout(timer))
  })
}
