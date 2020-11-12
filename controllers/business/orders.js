const db = require('../../db')
const statusConstant = require('../../constants/status')
const helper = require('../../services/helper')
const stripeService = require('../../services/stripe')
const mailingController = require('../mailing')

exports.getOrders = async (req, res) => {
  const { store } = req.state
  if (!store) return res.error('Store not found', 404)
  const {
    filter = {
      open: true,
    },
    page,
    limit,
  } = helper.getFilterAndPaging(req.query)
  let orders
  try {
    orders = await db.Order.find({
      store: store.id,
      paymentStatus: { $ne: statusConstant.PAYMENT_STATUS.NEW },
      ...filter,
    }).sort({ _id: -1 }).skip(page * limit).limit(limit)
  } catch (err) {
    return res.error(err.message)
  }
  res.success(orders)
}

exports.checkOrderOwner = async (req, res, next) => {
  const { store } = req.state
  const { id } = req.params
  try {
    req.state.order = await getOrderInternal(id)
  } catch (err) {
    return res.error(err.message)
  }
  if (!req.state.order) return res.error('Order not found', 400)
  if (req.state.order.store.toString() !== store.id) return res.error('Unauthorized', 401)
  next()
}

const getOrderInternal = (orderId) => {
  return db.Order.findById(orderId).populate({
    path: 'orderItems',
    model: db.OrderItem,
    populate: {
      path: 'product',
      select: 'name'
    }
  })
}
exports.getOrder = async (req, res) => {
  const { order } = req.state
  let orderObj = order.toJSON()
  orderObj.orderItems = orderObj.orderItems.map(i => helper.formatMoneyObj(i, ['price', 'total']))
  orderObj = helper.formatMoneyObj(orderObj, ['total', 'subtotal', 'ccFee', 'percentageFee', 'fixedFee'])
  res.success(orderObj)
}

exports.updateOrder = async (req, res) => {
  const { order, store } = req.state
  const { status } = req.body
  // prevent updating completed order
  if (!order.open) return res.error('Order completed')
  if (status && Object.values(statusConstant.ORDER).includes(status)) {
    if (status === statusConstant.ORDER.CANCELLED) {
      order.open = false
    } else if (status === statusConstant.ORDER.PACKED) {
      // pack order items, recalculate order total
      let totalAmount = 0
      try {
        await Promise.all(order.orderItems.map(async item => {
          if (![statusConstant.ORDER_ITEM.OUT_OF_STOCK, statusConstant.ORDER_ITEM.REMOVED].includes(item.status)) {
            item.status = statusConstant.ORDER_ITEM.PACKED
            totalAmount += (item.price * item.quantity)
            return item.save()
          }
        }))
      } catch (err) {
        res.error(err.message, 500)
      }
      order.subtotal = totalAmount * 100 / 100
      order.total = order.subtotal + (order.subtotal * (store.tax || 0) / 100) + (store.pickupFee || 0)
    } else if (status === statusConstant.ORDER.COMPLETED) {
      if (order.status !== statusConstant.ORDER.PACKED) {
        return res.error('Please pack order first')
      }
      order.open = false
      try {
        await capturePayment(order, store.fixedFee, store.percentageFee)
      } catch (err) {
        console.error('capturePayment', err)
        return res.error(`Error capturing payment: ${err.message}`)
      }
    }
    order.status = status
  }
  if (status === statusConstant.ORDER.PACKED && !order.sentPacked) {
    const sent = await mailingController.sendEmailOrderPacked(order._id)
    if (sent) order.sentPacked = true
  }
  if (status === statusConstant.ORDER.COMPLETED && !order.sentCompleted) {
    const sent = await mailingController.sendEmailOrderCompleted(order._id)
    if (sent) order.sentCompleted = true
  }
  order.customerModifiable = false // customer can not update order after SO update order
  try {
    await order.save()
  } catch (err) {
    return res.error(err.message)
  }
  const orderObj = helper.formatMoneyObj(order.toJSON(), ['total', 'subtotal', 'ccFee', 'percentageFee', 'fixedFee'])
  orderObj.orderItems = orderObj.orderItems.map(i => ({
    ...i,
    price: Math.round(i.price * 100) / 100,
    total: Math.round(i.total * 100) / 100,
  }))
  res.success(orderObj)
}

const capturePayment = async (order, storeFixedFee, storePercentageFee) => {
  let paymentIndent
  try {
    paymentIndent = await db.OrderPaymentIndent.findOne({
      order: order._id,
    })
  } catch (err) {
    throw err
  }
  if (!paymentIndent) {
    order.status = statusConstant.ORDER.FAILED
    throw new Error('Order payment indent not found')
  }
  // capture
  const {
    ccFee,
    percentageFee,
    fixedFee,
  } = helper.getFeeAmounts(order.total, storeFixedFee, storePercentageFee, order.pickupFee)
  let stripePaymentIndent
  try {
    stripePaymentIndent = await stripeService.capturePaymentIndent({
      id: paymentIndent.indentId,
      amount: Math.round(order.totalPaid * 100),
      fee: Math.round(ccFee * 100 + fixedFee * 100 + percentageFee * 100),
    })
    if (!stripePaymentIndent) throw new Error('Unable to capture')
  } catch (err) {
    throw err
  }
  // capture fund successfully
  // order.status = statusConstant.ORDER.PAID 
  order.capturedTotal = order.totalPaid
  order.fixedFee = fixedFee
  order.percentageFee = percentageFee
  order.ccFee = ccFee
  paymentIndent.status = stripePaymentIndent.status
  return order
}

exports.updateOrderItem = async (req, res) => {
  const { order, store } = req.state
  const { itemId } = req.params
  const { status } = req.body
  // prevent updating completed order
  if (!order.open) return res.error('Order completed')
  const orderItem = order.orderItems.find(item => item.id === itemId)
  if (!orderItem) return res.error('Order item not found', 400)
  if (orderItem.status === statusConstant.ORDER_ITEM.REMOVED) return res.error('This item has been removed by the customer.', 400)
  if (status && Object.values(statusConstant.ORDER_ITEM).includes(status)) {
    orderItem.status = status
  }
  await orderItem.save()
  // recalculate total and subtotal
  let newSubtotal = 0
  order.orderItems.forEach(item => {
    if (![statusConstant.ORDER_ITEM.OUT_OF_STOCK, statusConstant.ORDER_ITEM.REMOVED].includes(item.status)) {
      newSubtotal += Math.round((item.price * item.quantity) * 100) / 100
    }
  })
  const newTotal = newSubtotal + (newSubtotal * (store.tax || 0) / 100) + (store.pickupFee || 0)
  order.subtotal = newSubtotal
  order.total = newTotal
  order.status = statusConstant.ORDER.PREPARING
  if (order.orderItems.findIndex(item => item.status === statusConstant.ORDER_ITEM.PENDING) === -1) {
    order.status = statusConstant.ORDER.PACKED
  }
  order.customerModifiable = false // customer can not update order after SO update order
  await order.save()

  res.success({
    ...helper.formatMoneyObj(orderItem.toJSON(), ['price', 'total']),
    order: helper.formatMoneyObj(order.toJSON(), ['total', 'subtotal', 'ccFee', 'percentageFee', 'fixedFee']),
  })
}

exports.confirmPayment = async (req, res) => {
  const { order } = req.state
  // get payment token
  let paymentToken
  try {
    paymentToken = await db.OrderPaymentToken.findOne({
      order: order.id,
    })
  } catch (err) {
    return res.error(err.message)
  }
  if (!paymentToken) return res.error('Customer not gave their card data yet')
  let chargedPayment
  const payload = {
    token: paymentToken.token,
    amount: (order.total).toFixed(2) * 100,
    email: order.email,
  }
  try {
    chargedPayment = await stripeService.transferPayment(payload)
  } catch (err) {
    console.error('confirmPayment_makePayment', { payload, err })
    if (err.code === 'token_already_used') return res.error('Payment token is already used')
    return res.error(err.message)
  }
  console.log('chargedPayment', chargedPayment)
  // update payment token
  paymentToken.chargeId = chargedPayment.id
  paymentToken.paid = chargedPayment.paid
  paymentToken.receiptUrl = chargedPayment.receipt_url
  paymentToken.status = chargedPayment.status
  await paymentToken.save()
  // update order
  order.status = statusConstant.ORDER.PAID
  await order.save()
  res.success(order)
}
