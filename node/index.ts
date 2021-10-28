import type { ClientsConfig, ServiceContext, RecorderState } from '@vtex/api'
import { LRUCache, method, Service, UserInputError } from '@vtex/api'
import { createTransport } from 'nodemailer'

import { Clients } from './clients'
import { status } from './middlewares/status'
import { validate } from './middlewares/validate'

const TIMEOUT_MS = 800

// Create a LRU memory cache for the Status client.
// The @vtex/api HttpClient respects Cache-Control headers and uses the provided cache.
const memoryCache = new LRUCache<string, any>({ max: 5000 })

metrics.trackCache('status', memoryCache)

// This is the configuration for clients available in `ctx.clients`.
const clients: ClientsConfig<Clients> = {
  // We pass our custom implementation of the clients bag, containing the Status client.
  implementation: Clients,
  options: {
    // All IO Clients will be initialized with these options, unless otherwise specified.
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
    // This key will be merged with the default options and add this cache to our Status client.
    status: {
      memoryCache,
    },
  },
}

declare global {
  // We declare a global Context type just to avoid re-writing ServiceContext<Clients, State> in every handler and resolver
  type Context = ServiceContext<Clients, State>

  // The shape of our State object found in `ctx.state`. This is used as state bag to communicate between middlewares.
  interface State extends RecorderState {
    code: number
  }
}

// Export a service that defines route handlers and client options.
export default new Service({
  clients,
  routes: {
    // `status` is the route ID from service.json. It maps to an array of middlewares (or a single handler).
    status: method({
      GET: [validate, status],
    }),
    name: method({
      GET: [saludo],
    }),
    email: method({
      GET: [email],
    }),
  },
})

export async function saludo(ctx: Context, next: () => Promise<any>) {
  const {
    vtex: {
      route: { params },
    },
  } = ctx

  console.info('Received params:', params)

  const { name } = params

  if (!name) {
    throw new UserInputError('Code is required') // Wrapper for a Bad Request (400) HTTP Error. Check others in https://github.com/vtex/node-vtex-api/blob/fd6139349de4e68825b1074f1959dd8d0c8f4d5b/src/errors/index.ts
  }

  const nombre = name as string

  ctx.body = { greatings: `hola ${nombre}` }
  ctx.state.code = 200

  await next()
}

export async function email(ctx: Context, next: () => Promise<any>) {
  const {
    vtex: {
      route: { params },
    },
  } = ctx

  console.info('Received params:', params)

  const { name } = params

  if (!name) {
    throw new UserInputError('Code is required') // Wrapper for a Bad Request (400) HTTP Error. Check others in https://github.com/vtex/node-vtex-api/blob/fd6139349de4e68825b1074f1959dd8d0c8f4d5b/src/errors/index.ts
  }

  const transporter = createTransport({
    service: 'gmail',
    auth: {
      user: 'cencotestvtex@gmail.com',
      pass: 'cencoTest1234',
    },
  })

  const mailOptions = {
    from: 'cencotestvtex@gmail.com', // sender address
    to: 'arima121@gmail.com', // list of receivers
    subject: 'Subject of your email', // Subject line
    html: '<p>Your html here</p>',
  }

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      ctx.body = { greatings: `Message sent: ${err}` }
      ctx.state.code = 400
    } else {
      ctx.body = { greatings: `Message sent: ${info}` }
      ctx.state.code = 200
    }
  })

  await next()
}
