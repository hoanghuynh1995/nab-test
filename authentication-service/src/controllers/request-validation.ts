import Joi from 'joi'
import { Request, Response, NextFunction } from 'express'
import { error_codes as ERROR_CODES } from '../constants'
import base from '../entities/base'

const validate = (validator, path: 'body' | 'query') => (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let obj
  if (path === 'body') {
    obj = req.body
  } else if (path === 'query') {
    obj = req.query
  }
  if (obj) {
    const vldRs = validator.validate(obj)
    if (vldRs.error) {
      const response = base(null, vldRs.error.message, 0, ERROR_CODES.JOI_VALIDATION)
      next(response)
      return
    }
    next()
    return
  }
  next()
}

export const joiObjs = {
  user: {
    createUser: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      fullname: Joi.string().required(),
    }),
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  },
}

export default {
  validate,
}
