const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const userConstants = require('../constants/users')

const jwtCustomerSecret = process.env.CUSTOMER_JWT_SECRET_KEY
const jwtBusinessSecret = process.env.BUSINESS_JWT_SECRET_KEY
const jwtAdminSecret = process.env.ADMIN_JWT_SECRET_KEY

const SALT_ROUNDS = 10

exports.generateHash = password => {
  return bcrypt.hash(password, SALT_ROUNDS)
}

exports.compareHash = (password, hash) => {
  return bcrypt.compare(password, hash)
}

const getJwtSecret = type => {
  if (type === userConstants.USER_TYPE.BUSINESS) return jwtBusinessSecret
  if (type === userConstants.USER_TYPE.CUSTOMER) return jwtCustomerSecret
  if (type === userConstants.USER_TYPE.ADMIN) return jwtAdminSecret
}
exports.generateToken = async (data, type) => {
  return jwt.sign(data, getJwtSecret(type), { expiresIn: '1 days' })
}
exports.verifyToken = async (token, type) => {
  return jwt.verify(token, getJwtSecret(type))
}