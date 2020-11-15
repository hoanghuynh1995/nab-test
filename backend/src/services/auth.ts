import * as request from 'request-promise'

import { auth } from '../types/services'

import config from '../config'

const AUTH_URL = config.services.auth.url

const verifyToken = (data: auth.Request): Promise<auth.Response> => {
  return request(`${AUTH_URL}/priv/v1/users/verify_token`, {
    method: 'POST',
    body: {
      token: data.token,
    }
  })
}

export default {
  verifyToken,
}
