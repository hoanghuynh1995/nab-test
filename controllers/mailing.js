const moment = require('moment')
const db = require('../db')
const mailingService = require('../services/mailing')

exports.sendEmailOrderConfirmation = async orderId => {
  try {
    const [order, orderItems] = await Promise.all([
      db.Order.findOne({
        _id: orderId,
        // user: user._id,
      }).populate({
        path: 'store',
        model: 'stores',
        select: 'name'
      }).lean(),
      db.OrderItem.find({
        order: orderId
      }).select('_id').populate({
        path: 'product',
        model: 'products',
        select: 'name image'
      }).lean()
    ])
    mailingService.sendOrderConfirmedEmail({
      ...order,
      store: order.store.name,
      orderItems,
      pickupTime: moment(order.pickupTime).format('MMM DD, yyyy, h:mm A'),
      total: `$${order.total}`
    }, order.email)
  } catch (err) {
    console.error('sendEmailOrderConfirmation', err)
  }
  return true
}

exports.sendEmailOrderPacked = async orderId => {
  try {
    const [order, orderItems] = await Promise.all([
      db.Order.findOne({
        _id: orderId,
        // user: user._id,
      }).populate({
        path: 'store',
        model: 'stores',
        select: 'name'
      }).lean(),
      db.OrderItem.find({
        order: orderId
      }).select('_id').populate({
        path: 'product',
        model: 'products',
        select: 'name image'
      }).lean()
    ])
    mailingService.sendOrderPackedEmail({
      ...order,
      store: order.store.name,
      orderItems,
      pickupTime: moment(order.pickupTime).format('MMM DD, yyyy, h:mm A'),
      total: `$${order.total}`
    }, order.email)
  } catch (err) {
    console.error('sendEmailOrderPacked', err)
  }
  return true
}

exports.sendEmailOrderCompleted = async orderId => {
  try {
    const order = await db.Order.findOne({
      _id: orderId,
      // user: user._id,
    }).populate({
      path: 'store',
      model: 'stores',
      select: 'name'
    }).lean()
    mailingService.sendOrderCompletedEmail({
      ...order,
      store: order.store.name,
      pickupTime: moment(order.pickupTime).format('MMM DD, yyyy, h:mm A'),
      total: `$${order.total}`
    }, order.email)
  } catch (err) {
    console.error('sendEmailOrderCompleted', err)
  }
  return true
}

exports.sendEmailForgotPassword = async (link, email) => {
  try {
    mailingService.sendForgotPasswordEmail({
      link
    }, email)
  } catch (err) {
    console.error('sendEmailForgotPassword', err)
  }
  return true
}

exports.sendVerifyEmailEmail = async (link, email) => {
  try {
    mailingService.sendVerifyEmailEmail({
      link
    }, email)
  } catch (err) {
    console.error('sendVerifyEmailEmail', err)
  }
  return true
}

exports.sendTempPasswordEmail = async (data, email) => {
  try {
    mailingService.sendTempPassword(data, email)
  } catch (err) {
    console.error('sendTempPasswordEmail', err)
  }
  return true
}
