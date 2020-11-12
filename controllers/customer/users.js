const uuid = require('uuid')
const db = require('../../db')
const stripeService = require('../../services/stripe')
const statusConstants = require('../../constants/status')
const helper = require('../../services/helper')
const mailingController = require('../mailing')
const authUtils = require('../../utils/auth')

exports.addCardToken = async (req, res, next) => {
  const { user } = req.state
  const { token } = req.body
  if (!token) return res.error('Missing token', 400)
  let verifiedToken
  try {
    verifiedToken = await stripeService.verifyToken(token)
  } catch (err) {
    return res.error('Invalid token', 400)
  }
  if (verifiedToken.used) return res.error('Invalid token', 400)
  const toUpdate = {
    stripeToken: token
  }
  // if (!user.stripeId) {
  //   // create stripe customer
  //   let stripeCustomer
  //   try {
  //     stripeCustomer = await stripeService.createCustomer(token, user.email)
  //   } catch (err) {
  //     console.error('addCardToken_stripe_createCustomer', err)
  //     return res.error(err.message, 400)
  //   }
  //   toUpdate.stripeId = stripeCustomer.id
  // }
  req.user = await db.User.findOneAndUpdate(
    { _id: user._id, },
    { stripeToken: token },
  )
  res.success(verifiedToken)
}

exports.setAvatar = async (req, res) => {
  const {
    image,
  } = req.body
  if (!image) return res.error('image is required', 400)

  const {
    user: {
      _id: userId,
    },
  } = req.state
  let user
  try {
    user = await db.User.findById(userId)
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('User not found', 404)

  // check if image exists
  let file
  try {
    file = await db.File.findById(image)
  } catch (err) {
    return res.error(err.message)
  }
  if (file) {
    // if image not exist, use body.image as image
    file.status = statusConstants.FILE.USED
    file.save()
  }
  user.image = file.url
  try {
    await user.save()
  } catch (err) {
    return res.error(err.message)
  }
  res.success(user)
}

exports.updateUser = async (req, res) => {
  const { id: userId } = req.params
  const { user: userState } = req.state
  if (userState._id !== userId) return res.error('Unauthorized', 401)
  let user
  try {
    user = await db.User.findById(userState._id)
      .select('-password -token')
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('User not found', 404)

  const {
    firstName,
    lastName,
    phone,
  } = req.body
  user.firstName = firstName || user.firstName
  user.lastName = lastName || user.lastName
  user.phone = phone || user.phone
  try {
    await user.save()
  } catch (err) {
    return res.error(err.message)
  }
  res.success(user)
}

exports.getData = async (req, res) => {
  const { id: userId } = req.params
  const { user: userState } = req.state
  if (userState._id !== userId) return res.error('Unauthorized', 401)
  let user
  try {
    user = await db.User.findById(userState._id)
      .select('-password -token')
      .lean()
  } catch (err) {
    return res.error(err.message)
  }
  if (!user) return res.error('User not found', 404)
  res.success(user)
}

exports.forgetPassword = async (req, res) => {
  let { email } = req.body
  if (!email) return res.error('Email is required')
  email = email.trim().toLowerCase()
  let user
  try {
    user = await db.User.findOne({
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
    const resetPwdLink = helper.getResetPasswordCustomerLink(user.email, forgetPwdToken)
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
    user = await db.User.findOne({
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
