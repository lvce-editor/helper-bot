import { expect, test, jest } from '@jest/globals'

test('sets HOST in production when missing', async () => {
  const runApp = jest.fn()
  const { main } = await import('../src/main.ts')

  await main(runApp as any, {
    APP_ID: '123',
    NODE_ENV: 'production',
  })

  expect(runApp).toHaveBeenCalledWith(expect.any(Function), {
    env: {
      APP_ID: '123',
      HOST: '0.0.0.0',
      NODE_ENV: 'production',
    },
  })
})

test('keeps HOST when already configured', async () => {
  const runApp = jest.fn()
  const { main } = await import('../src/main.ts')

  await main(runApp as any, {
    APP_ID: '123',
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
  })

  expect(runApp).toHaveBeenCalledWith(expect.any(Function), {
    env: {
      APP_ID: '123',
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
    },
  })
})
