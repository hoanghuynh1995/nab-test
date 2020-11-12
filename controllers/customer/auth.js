const uuid = require('uuid')
const db = require('../../db')
const authUtils = require('../../utils/auth')
const commonDbOpts = require('../common')
const userConstant = require('../../constants/users')
const mailingController = require('../mailing')
const helper = require('../../services/helper')

const login = async (req, res) => {
  let {
    email,
    password,
  } = req.body
  if (!email || !password) return res.error('Missing email or password', 400)
  email = email.toLowerCase()
  let user
  try {
    user = await commonDbOpts.login({
      email
    }, password, db.User, userConstant.USER_TYPE.CUSTOMER)
  } catch (err) {
    return res.error(err.message, 400)
  }
  res.success(user)
}
const createUser = async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    zipCode,
    email,
    password,
  } = req.body
  const data = {
    firstName,
    lastName,
    phone,
    zipCode,
    email: email.toLowerCase(),
    password,
    // verifyToken: uuid.v1(),
  }

  const user = new db.User(data)

  await commonDbOpts.createUser(user)
  login(req, res)
  // res.success(createdUser)

  // let createdUser
  // try {
  //   createdUser = await commonDbOpts.createUser(user)
  // } catch (err) {
  //   return res.error(err.message)
  // }
  // res.success({
  //   ...createdUser.toJSON(),
  //   password: undefined,
  //   verifyToken: undefined,
  // })
  // try {
  //   const verifyEmailLink = helper.getVerifyCustomerEmailLink(email, data.verifyToken)
  //   mailingController.sendVerifyEmailEmail(verifyEmailLink, email)
  // } catch (err) {
  //   return res.error(err.message)
  // }
}
module.exports = {
  login,
  createUser,
  verifyEmail: async (req, res) => {
    let {
      email,
      token,
    } = req.query
    if (!email) return res.error('email is required')
    if (!token) return res.error('token is required')
    email = email.trim().toLowerCase()
    let pendingUser
    try {
      pendingUser = await db.PendingUser.findOne({
        email,
      }).lean()
    } catch (err) {
      return res.error(err.message)
    }
    if (!pendingUser) return res.error('Email not found')
    if (pendingUser.verifyToken !== token) return res.error('Wrong token')

    // create new user
    let user
    try {
      // check if exists first due to last time error request
      user = await db.User.findOne({
        email,
      })
      if (user) return
      user = await db.User.create({
        ...pendingUser,
        _id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      })
    } catch (err) {
      return res.error(err.message)
    }
    // delete pending user
    try {
      await db.PendingUser.findOneAndRemove({
        _id: pendingUser._id.toJSON(),
      })
    } catch (err) {
      console.error('verifyEmail_deletePendingUser', err)
    }
    res.send('Email is verified successfully!')
  },

  checkEmailExists: async (req, res, next) => {
    let email = req.body.email
    if (!email) {
      return res.error('Email is required', 400)
    }
    email = email.toLowerCase()
    var query = { "email": email };
    const user = await db.User.findOne(query)
    if (user) {
      return res.error('Email already in use', 400)
    }
    next()
  },
  checkToken: async (req, res, next) => {
    const token = req.headers['authorization']
    if (!token) {
      return res.error('Missing token', 401)
    }
    try {
      const user = await commonDbOpts.checkToken(token, userConstant.USER_TYPE.CUSTOMER)
      if (!user) {
        return res.error('Token invalid', 401)
      }
      req.state.user = user
      next()
    } catch (err) {
      res.error('Token expired', 401)
    }
  },
  checkTokenWithUser: async (req, res, next) => {
    const token = req.headers['authorization']
    if (!token) {
      return res.error('Missing token', 401)
    }
    let validUser
    try {
      validUser = await commonDbOpts.checkToken(token)
      if (!validUser) {
        return res.error('Token invalid', 401)
      }
    } catch (err) {
      return res.error('Token expired', 401)
    }
    try {
      req.state.user = await db.User.findById(validUser._id).select('-password').lean()
    } catch (err) {
      return res.error(err.message, 500)
    }
    if (!req.state.user) {
      return res.error('User not found', 404)
    }
    next()
  },
  optionalCheckToken: async (req, res, next) => {
    const token = req.headers['authorization']
    if (!token) {
      return next();
    }
    try {
      const user = await commonDbOpts.checkToken(token, userConstant.USER_TYPE.CUSTOMER)
      if (!user) {
        return res.error('Token invalid', 401)
      }
      req.state.user = user
      next()
    } catch (err) {
      res.error('Token expired', 401)
    }
  }
}