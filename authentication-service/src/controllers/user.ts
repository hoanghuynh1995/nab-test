import { Request, Response, NextFunction } from 'express'

import { error_codes as ERROR_CODES } from '../constants'
import base from '../entities/base'
import db from '../db'
import utils from '../utils'

interface ISignupRequest {
  email: string;
  password: string;
  fullname: string;
}
const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    email,
    password,
    fullname,
  } = <ISignupRequest>req.body
  try {
    const user = await db.User.findOne({
      where: { email }
    })
    if (user) throw new Error('Email existed')
  } catch (err) {
    const body = base(null, err.message, 0, ERROR_CODES.DB_QUERY)
    res.send(body)
    return
  }
  const hashedPassword = await utils.auth.generateHash(password)
  const userData = {
    email,
    password: hashedPassword,
    fullname,
  }
  let user
  try {
    user = await db.User.create(userData)
  } catch (err) {
    const body = base(null, err.message, 0, ERROR_CODES.DB_QUERY)
    next(body)
    return
  }
  delete user.password
  res.send(user)
}

interface ILoginRequest {
  email: string;
  password: string;
  fullname: string;
}
const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    email,
    password,
  } = <ILoginRequest>req.body
  let user
  try {
    user = await db.User.findOne({
      where: { email },
      raw: true,
    })
  } catch (err) {
    const body = base(null, err.message, 0, ERROR_CODES.DB_QUERY)
    res.send(body)
    return
  }
  if (!user) {
    const body = base(null, 'Invalid Email or Password', 0, ERROR_CODES.BAD_REQUEST)
    res.send(body)
    return
  }
  // compare password hash
  const valid = await utils.auth.compareHash(password, user.password)
  if (!valid) {
    const body = base(null, 'Invalid Email or Password', 0, ERROR_CODES.BAD_REQUEST)
    res.send(body)
    return
  }
  delete user.password
  // generate token
  const token = await utils.auth.generateToken(user)
  const response = {
    ...user,
    token,
  }
  res.send(response)
}
interface IVerifyTokenRequest {
  token: string;
}
const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    token,
  } = <IVerifyTokenRequest>req.body
  let response
  try {
    response = await utils.auth.verifyToken(token)
  } catch (err) {
    const body = base(null, 'Invalid token', 0, ERROR_CODES.BAD_REQUEST)
    res.send(body)
    return
  }
  const body = base(response)
  res.send(body)
}

export default {
  signup,
  login,
  verifyToken,
}
