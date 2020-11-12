const uuid = require('uuid')
const moment = require('moment')

const authUtils = require('../../utils/auth')
const commonDbOpts = require('../common')
const db = require('../../db')
const helper = require('../../services/helper')
const stripeService = require('../../services/stripe')
const storeConstant = require('../../constants/store')
const userConstant = require('../../constants/users')
const mailingController = require('../mailing')

exports.login = async (req, res) => {
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
    }, password, db.BusinessUser, userConstant.USER_TYPE.BUSINESS)
  } catch (err) {
    return res.error(err.message, 400)
  }
  res.success(user)
}

exports.createUser = async (req, res, next) => {
  const {
    firstName,
    lastName,
    username,
    email,
    phoneNumber,
    address,
    storeName,
    storeType,
    password,
    zipCode,
  } = req.body
  let tempPassword
  if (!password) tempPassword = helper.nanoid_password()
  let {
    geo
  } = req.body
  // check if their zipcode exists in our database
  if (zipCode) {
    let zipCodeExisted
    try {
      zipCodeExisted = await db.ZipCode.findOne({ zipcode: zipCode })
    } catch (err) {
      console.error('createUser_check_zipcode', err)
    }
    if (zipCodeExisted) {
      geo = [zipCodeExisted.long, zipCodeExisted.lat]
    }
  }
  const data = {
    firstName,
    lastName,
    username,
    email: email.toLowerCase(),
    phoneNumber,
    address,
    storeName,
    storeType,
    password: password || tempPassword,
    loc: geo,
    zipCode,
    verifyToken: uuid.v1(),
  }

  const user = new db.PendingBusinessUser(data)
  let createdUser
  try {
    createdUser = await commonDbOpts.createUser(user)
  } catch (err) {
    return res.error(err.message)
  }
  res.success({
    ...createdUser.toJSON(),
    password: undefined,
    verifyToken: undefined,
  })
  try {
    const verifyEmailLink = helper.getVerifyEmailLink(email, data.verifyToken)
    mailingController.sendVerifyEmailEmail(verifyEmailLink, email)
  } catch (err) {
    return res.error(err.message)
  }
  if (tempPassword) {
    const loginLink = helper.getBusinessLoginLink()
    const resetPwdLink = helper.getForgetPasswordLink()
    try {
      mailingController.sendTempPasswordEmail({
        password: tempPassword,
        loginLink,
        resetPwdLink,
      }, email)
    } catch (err) {
      return res.error(err.message)
    }
  }
}

exports.checkEmailExists = async (req, res, next) => {
  let email = req.body.email
  if (!email) {
    return res.error('Email is required', 400)
  }
  email = email.trim().toLowerCase()
  var query = { "email": email };
  const [user, pendingUser] = await Promise.all([
    db.BusinessUser.findOne(query),
    db.PendingBusinessUser.findOne(query)
  ])
  if (user || pendingUser) {
    return res.error('Email already in use', 400)
  }
  next()
}

exports.verifyEmail = async (req, res, next) => {
  let {
    email,
    token,
  } = req.query
  if (!email) return res.error('email is required')
  if (!token) return res.error('token is required')
  email = email.trim().toLowerCase()
  let pendingUser
  try {
    pendingUser = await db.PendingBusinessUser.findOne({
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
    user = await db.BusinessUser.findOne({
      email,
    })
    if (user) return
    user = await db.BusinessUser.create({
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
    await db.PendingBusinessUser.findOneAndRemove({
      _id: pendingUser._id.toJSON(),
    })
  } catch (err) {
    console.error('verifyEmail_deletePendingUser', err)
  }
  req.state.user = user
  next()
}

exports.checkToken = async (req, res, next) => {
  const token = req.headers['authorization']
  if (!token) {
    return res.error('Missing token', 401)
  }
  try {
    const user = await commonDbOpts.checkToken(token, userConstant.USER_TYPE.BUSINESS)
    if (!user) {
      return res.error('Token invalid', 401)
    }
    req.state.user = user
    next()
  } catch (err) {
    res.error('Token expired', 401)
  }
}

/**
 * Get full data to initialize
 */
exports.getData = async (req, res) => {
  const { id: userId } = req.params
  const { user: userState } = req.state
  if (userState._id !== userId) return res.error('Unauthorized', 401)
  let user
  try {
    user = await db.BusinessUser.findById(userState._id)
      .select('-password -token')
      .populate({
        path: 'stores',
        populate: 'categories'
      }).lean()
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('User not found', 404)
  let store
  try {
    store = await db.Store.findOne({
      businessUserId: user._id
    })
  } catch (err) {
    return res.error(err.message)
  }
  let categories = [], subcategories = []
  if (store) {
    let res
    try {
      res = await Promise.all([
        db.Category.find({
          store: store._id
        }),
        db.Subcategory.find({
          store: store._id
        })
      ])
    } catch (err) {
      return res.error(err.message)
    }
    categories = res[0]
    subcategories = res[1]
  }
  res.success({
    ...user,
    store,
    categories,
    subcategories,
  })
}

exports.getStore = async (req, res, next) => {
  const { user } = req.state
  try {
    req.state.store = await db.Store.findOne({
      businessUserId: user._id
    })
  } catch (err) {
    return res.error(err.message, 500)
  }
  next()
}

/**
 * store state code to prevent csrf attack then redirect to stripe form
 */
exports.linkPayment = async (req, res) => {
  const { user } = req.state
  const token = uuid.v1()
  const savedUser = await db.BusinessUser.findByIdAndUpdate(user._id, {
    csrfToken: token,
  })
  const redirectUrl = helper.buildStripeAuthLink(`${user._id}_${token}`, user)
  res.success(redirectUrl)
}

exports.setStripeAccount = async (req, res, next) => {
  const {
    code, state
  } = req.query
  const [userId, csrfToken] = state.split('_')
  let user
  try {
    user = await db.BusinessUser.findById(userId)
  } catch (err) {
    console.error('setStripeAccount_getUser', err)
    return res.error(err.message)
  }
  if (!user) {
    return res.error('User not found')
  }
  if (user.csrfToken !== csrfToken) return res.error('Invalid csrf token')
  let account
  try {
    account = await stripeService.authorizeToken(code)
  } catch (err) {
    return res.error(err.message)
  }
  user.stripeAccount = account.stripe_user_id
  await user.save()
  const redirectUrl = helper.redirectLinkAfterStripeAuth()
  res.redirect(redirectUrl)
}

exports.updateUser = async (req, res, next) => {
  const { id: userId } = req.params
  const { user: userState } = req.state
  if (userState._id !== userId) return res.error('Unauthorized', 401)
  let user
  try {
    user = await db.BusinessUser.findById(userState._id)
      .select('-password -token')
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('User not found', 404)
  let store
  try {
    store = await db.Store.findOne({
      businessUserId: user._id
    })
  } catch (err) {
    return res.error(err.message)
  }
  if (!store) return res.error('Store not found', 404)

  const {
    firstName,
    lastName,
    phoneNumber,
    address,
    storeName,
    storeType,
    zipCode,
    openTime,
    geo,
    minPackingTime,
  } = req.body
  user.firstName = firstName || user.firstName
  user.lastName = lastName || user.lastName
  user.phoneNumber = phoneNumber || user.phoneNumber
  user.address = address || user.address
  store.name = storeName || store.name
  store.type = storeConstant.TYPES.includes(storeType) ? storeType : store.type
  store.zipCode = zipCode || store.zipCode
  store.address = address || store.address
  if (openTime) {
    store.openTime = store.openTime || {}
    for (let key in openTime) {
      if (!openTime[key].from || !openTime[key].to) {
        store.openTime[key] = {}
        continue
      }
      // const from = new Date(openTime[key].from)
      // const to = new Date(openTime[key].to)
      // check validity
      // const fromMoment = moment.utc(`${from.getHours()}:${from.getMinutes()}`, 'hh:mm')
      // const toMoment = moment.utc(`${to.getHours()}:${to.getMinutes()}`, 'hh:mm')
      const fromMoment = moment.parseZone(openTime[key].from)
      const toMoment = moment.parseZone(openTime[key].to)
      if (fromMoment.diff(toMoment) > 0) return res.error(`Invalid opening time ${key}day`, 400)
      // TODO: add regex to check format here
      store.openTime[key] = { from: openTime[key].from, to: openTime[key].to }
    }
  }
  if (geo) {
    store.loc = geo
  }
  store.minPackingTime = Number.isNaN(minPackingTime) ? store.minPackingTime : minPackingTime;
  try {
    await Promise.all([
      user.save(),
      store.save()
    ])
  } catch (err) {
    return res.error(err.message)
  }
  res.success({
    ...user.toJSON(),
    store: store.toJSON(),
  })
  user.stripeAccount && persistStripeAfterUserUpdate(user.stripeAccount, {
    address: user.address,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
  })
}

const persistStripeAfterUserUpdate = async (accountId, {
  address,
  firstName,
  lastName,
  phoneNumber,
}) => {
  let account
  try {
    account = await stripeService.retriveAccount
  } catch (err) {
    return console.error('persistStripeAfterUserUpdate_getAccount', err)
  }
  if (!account) return console.error(`Stripe account ${accountId} not found`)
  try {
    await stripeService.updateAccountIndividual(accountId, {
      individual: {
        address,
        first_name: firstName,
        last_name: lastName,
        phone: phoneNumber,
      }
    })
  } catch (err) {
    console.error('persistStripeAfterUserUpdate_updateAccount', err)
  }
}

exports.forgetPassword = async (req, res) => {
  let { email } = req.body
  if (!email) return res.error('Email is required')
  email = email.trim().toLowerCase()
  let user
  try {
    user = await db.BusinessUser.findOne({
      email
    })
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('Email not found')
  const forgetPwdToken = uuid.v1()
  user.forgetPwdToken = forgetPwdToken
  try {
    await user.save()
  } catch (err) {
    return res.error(err.message)
  }
  // send email
  try {
    const resetPwdLink = helper.getResetPasswordLink(user.email, forgetPwdToken)
    mailingController.sendEmailForgotPassword(resetPwdLink, user.email)
  } catch (err) {
    return res.error(err.message)
  }
  res.success(true)
}

exports.resetPassword = async (req, res) => {
  let { email, token, newPassword } = req.body
  if (!email) return res.error('email is required')
  if (!token) return res.error('token is required')
  if (!newPassword) return res.error('newPassword is required')
  email = email.trim().toLowerCase()
  let user
  try {
    user = await db.BusinessUser.findOne({
      email
    })
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('Email not found')
  if (token !== user.forgetPwdToken) return res.error('Wrong token')
  user.forgetPwdToken = undefined
  user.password = await authUtils.generateHash(newPassword)
  try {
    await user.save()
  } catch (err) {
    return res.error(err.message)
  }
  res.success(true)
}
