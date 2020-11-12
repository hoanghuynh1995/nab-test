const uuid = require('uuid')
const moment = require('moment')

const authUtils = require('../../utils/auth')
const commonDbOpts = require('../common')
const db = require('../../db')
const userConstant = require('../../constants/users')

exports.login = async (req, res) => {
  let {
    username,
    password,
  } = req.body
  if (!username || !password) return res.error('Missing username or password', 400)
  username = username.toLowerCase()
  let user
  try {
    user = await commonDbOpts.login({
      username
    }, password, db.Admin, userConstant.USER_TYPE.ADMIN)
  } catch (err) {
    return res.error(err.message, 400)
  }
  res.success(user)
}

exports.checkToken = async (req, res, next) => {
  const token = req.headers['authorization']
  if (!token) {
    return res.error('Missing token', 401)
  }
  try {
    const user = await commonDbOpts.checkToken(token, userConstant.USER_TYPE.ADMIN)
    if (!user) {
      return res.error('Token invalid', 401)
    }
    req.state.user = user
    next()
  } catch (err) {
    res.error('Token expired', 401)
  }
}