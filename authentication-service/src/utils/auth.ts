import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import config from '../config'

const jwtSecret = config.jwt.secret

const SALT_ROUNDS = 10

const generateHash = password => {
  return bcrypt.hash(password, SALT_ROUNDS)
}
const compareHash = (password, hash) => {
  return bcrypt.compare(password, hash)
}
const generateToken = async data => {
  return jwt.sign(data, jwtSecret, { expiresIn: '1 days' })
}
const verifyToken = async token => {
  return jwt.verify(token, jwtSecret)
}

export default {
  generateHash,
  compareHash,
  generateToken,
  verifyToken,
}