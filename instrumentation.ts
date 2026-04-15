export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeZmqListener } = await import('@/lib/zmq-init')
    await initializeZmqListener()
  }
}
