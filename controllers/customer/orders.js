const moment = require('moment')
const db = require('../../db')
const statusConstant = require('../../constants/status')
const helper = require('../../services/helper')
const stripeService = require('../../services/stripe')
const mailingController = require('../mailing')
const orderConstant = require('../../constants/orders')

exports.checkBeforeCreateOrder = async (req, res, next) => {
  // first check if payload is valid
  const {
    paymentMethod,
    products,
    pickupFee,
    total, // used to verify clientside is calculating right
  } = req.body
  if (paymentMethod && !Object.values(statusConstant.PAYMENT_METHOD).includes(paymentMethod))
    return res.error('Invalid paymentMethod', 400)
  if (!products) return res.error('Missing products', 400)
  if (!Array.isArray(products)) return res.error('Invalid products', 400)
  for (let i = 0; i < products.length; i++) {
    if (!products[i].product) return res.error('Invalid product', 400)
    if (!products[i].quantity) products[i].quantity = 1
  }
  if (!total) return res.error('Missing total', 400)

  // check data validity
  req.state.subtotal = 0
  let productsFound
  try {
    productsFound = await Promise.all(products.map(async p => {
      let product
      try {
        product = await db.Product.findById(p.product).lean()
        if (!product) throw new Error('Product not found')
      } catch (err) {
        throw err
      }
      // check inventory
      if (product.inventory === 0) {
        const err = new Error(`${product.name} is out of stock`)
        err.code = -1 // show cart
        throw err
      }
      if (product.inventory < p.quantity) {
        throw new Error(`${product.name} - ${product.inventory} item(s) left`)
      }
      // check if store is the same
      if (!req.state.storeId) {
        req.state.storeId = product.store.toString()
      } else if (product.store.toString() !== req.state.storeId) {
        throw new Error('Products must be of one store')
      }
      let productTotal = product.price * p.quantity
      req.state.subtotal += productTotal
      return {
        ...product,
        quantity: p.quantity,
        total: productTotal,
      }
    }))
  } catch (err) {
    return res.error(err)
  }
  // round Number
  req.state.subtotal = Math.round(req.state.subtotal * 100) / 100
  // get store
  try {
    req.state.store = await db.Store.findById(req.state.storeId)
    if (!req.state.store) throw new Error('Store not found')
  } catch (err) {
    return res.error(err.message)
  }
  req.state.tax = req.state.subtotal * (req.state.store.tax / 100)
  const storePickupFee = Math.round(((req.state.store.fixedPickupFee || 0) + req.state.subtotal * (req.state.store.percentagePickupFee || 0) / 100) * 100) / 100
  if (pickupFee !== storePickupFee) return res.error('invalid pickupFee', 400)
  if (Math.round((req.state.subtotal + req.state.tax + storePickupFee) * 100) / 100 !== Number(total)) return res.error('invalid total', 400)
  req.state.products = productsFound
  next()
}

exports.createOrder = async (req, res, next) => {
  const { user = {}, storeId } = req.state
  const {
    firstName = user.firstName,
    lastName = user.lastName,
    email = user.email,
    phone = user.phone,
    billingAddress = '',
    zipCode = user.zipCode,
    pickupTime,
    total,
    paymentMethod,
    pickupFee,
  } = req.body
  if (!firstName) return res.error('Firstname is required')
  if (!lastName) return res.error('Lastname is required')
  if (!email) return res.error('Email is required')
  const {
    products,
    subtotal,
  } = req.state
  // create order
  let order
  try {
    order = await db.Order.create({
      user: user._id,
      store: storeId,
      firstName,
      lastName,
      email,
      phone,
      billingAddress,
      zipCode,
      pickupTime,
      subtotal,
      total: Math.round((total - pickupFee) * 100) / 100,
      totalPaid: total,
      pickupFee: pickupFee,
      paymentMethod,
      shortId: helper.nanoid(),
      guestCheckout: user._id ? false : true,
    })
  } catch (err) {
    return res.error(err)
  }

  // create order items
  let orderItems
  try {
    orderItems = await Promise.all(products.map(product => {
      return db.OrderItem.create({
        order: order._id,
        product: product._id,
        price: product.price,
        quantity: product.quantity,
        total: product.total,
      })
    }))
  } catch (err) {
    return res.error(err)
  }
  order.orderItems = orderItems.map(item => item._id.toString())
  await order.save()
  req.state.order = order
  next()
}

exports.getOrders = async (req, res) => {
  const { user } = req.state
  const {
    filter,
    page,
    limit,
  } = helper.getFilterAndPaging(req.query)
  let orders
  try {
    orders = await db.Order.find({
      user: user._id,
      paymentStatus: { $ne: statusConstant.PAYMENT_STATUS.NEW },
      ...filter,
    }).populate('store', 'name').sort({ _id: -1 }).skip(page * limit).limit(limit)
  } catch (err) {
    return res.error(err.message)
  }
  res.success(orders)
}

exports.getOrder = async (req, res) => {
  const { user } = req.state
  const { id } = req.params
  let order
  try {
    order = await getOrderInternal(id, user._id)
  } catch (err) {
    return res.error(err.message)
  }
  if (!order) return res.error('Order not found', 404)
  order = helper.formatMoneyObj(order, ['total', 'subtotal', 'ccFee', 'percentageFee', 'fixedFee'])
  order.orderItems = order.orderItems.map(i => helper.formatMoneyObj(i, ['price', 'total']))
  res.success(order)
}

const getOrderInternal = (orderId, userId, lean = true) => {
  let res = db.Order.findOne({
    _id: orderId,
    user: userId
  }).populate({
    path: 'orderItems',
    model: db.OrderItem,
    populate: {
      path: 'product',
      select: 'name'
    }
  })
  if (lean) res = res.lean()
  return res
}

exports.addOrderPaymentIndent = async (req, res) => {
  const {
    order
  } = req.state
  let owner
  try {
    owner = await db.Store.findById(order.store.toString(), 'businessUserId fixedFee percentageFee')
      .populate('businessUserId')
  } catch (err) {
    return res.error(err.message)
  }
  if (!owner) return res.error('Store owner not found', 404)
  // issue payment indent
  const {
    ccFee,
    percentageFee,
    fixedFee,
  } = helper.getFeeAmounts(order.total, owner.fixedFee, owner.percentageFee, order.pickupFee)
  let paymentIndent
  try {
    paymentIndent = await stripeService.createPaymentIndent({
      amount: Math.round(order.totalPaid * 100 * 100) / 100,
      fee: Math.round(ccFee * 100 + percentageFee * 100 + fixedFee * 100),
      accountId: owner.businessUserId.stripeAccount,
    })
  } catch (err) {
    console.error(err)
    return res.error('Error requesting payment')
  }
  // save
  try {
    await db.OrderPaymentIndent.create({
      order: order._id,
      indentId: paymentIndent.id,
      status: paymentIndent.status
    })
  } catch (err) {
    return res.error(err.message)
  }
  // update order fee
  order.fixedFee = fixedFee
  order.percentageFee = percentageFee
  order.ccFee = ccFee
  order.save()
  res.success({
    ...order.toObject(),
    clientSecret: paymentIndent.client_secret,
  })
}

exports.excludeInventory = async (req, res) => {
  try {
    const { id: orderId } = req.params
    const items = await db.OrderItem.find({
      order: orderId
    }).select('_id quantity').populate({
      path: 'product',
      model: 'products'
    })
    items.forEach(i => {
      i.product.inventory -= i.quantity
      i.product.save()
    })
  } catch (err) {
    console.error('excludeInventory', err)
  }
}
exports.orderAuthorizePayment = async (req, res, next) => {
  const { id } = req.params
  let order
  try {
    order = await db.Order.findOne({
      _id: id,
      // user: user._id,
    }).populate({
      path: 'store',
      model: 'stores',
      select: 'name'
    })
  } catch (err) {
    return res.error(err.message)
  }
  if (!order) return res.error('Order not found', 400)
  let paymentIndent
  try {
    paymentIndent = await db.OrderPaymentIndent.findOne({
      order: order._id,
    })
  } catch (err) {
    return res.error(err.message)
  }
  if (!paymentIndent) return res.error('Order payment indent not found', 400)
  // check payment indent status
  let stripePaymentIndent
  try {
    stripePaymentIndent = await stripeService.retrievePaymentIndent(paymentIndent.indentId)
  } catch (err) {
    return res.error(err.message)
  }
  if (!stripePaymentIndent) return res.error('Payment indent not found', 400)
  // if (stripePaymentIndent.status !== statusConstant.STRIPE_PAYMENT_INDENT.REQUIRES_CAPTURE)
  //   return res.error('Invalid payment indent status')
  paymentIndent.status = stripePaymentIndent.status
  await paymentIndent.save()
  order.paymentStatus = statusConstant.PAYMENT_STATUS.COMPLETED
  order.paymentMethod = stripePaymentIndent.paymentMethod[stripePaymentIndent.paymentMethod.type].brand
  try {
    await order.save()
  } catch (err) {
    return res.error(err.message)
  }
  // sending email
  mailingController.sendEmailOrderConfirmation(id)
  res.success({
    ...order.toJSON(),
    paymentIndent,
  })
  return next()
}

exports.getOrderItem = async (req, res, next) => {
  const { user } = req.state
  const { id, itemId } = req.params
  // let orderItem
  // try {
  //   orderItem = await db.OrderItem.findById(itemId).populate({
  //     model: 'orders',
  //     path: 'order',
  //     match: { _id: id, user: user._id },
  //     populate: {
  //       path: 'store',
  //       model: 'stores',
  //     }
  //   })
  // } catch (err) {
  //   return res.error(err.message)
  // }
  let order
  try {
    order = await getOrderInternal(id, user._id, false)
  } catch (err) {
    return res.error(err.message)
  }
  if (!order) return res.error('Order not found', 404)
  const orderItem = order.orderItems.find(i => i._id.toString() === itemId)
  if (!orderItem) return res.error('Item not found')
  // only allow to edit in 3 hours
  if (!order.customerModifiable ||
    moment().diff(moment(order.createdAt)) > orderConstant.MAX_EDIT_ORDER_TIME) {
    return res.error("Your order has been packed, updates can't be made", 400)
  }
  // get store to calculate total if there is changes
  let store
  try {
    store = await db.Store.findById(order.store)
  } catch (err) {
    return res.error(err.message)
  }
  req.state.orderItem = orderItem
  req.state.order = order
  req.state.store = store
  next()
}

exports.updateOrderItem = async (req, res) => {
  const { orderItem, order, store } = req.state
  const { status } = req.body
  if (!status) return res.error('status is required')
  if ((status === statusConstant.ORDER_ITEM.REMOVED && orderItem.status !== statusConstant.ORDER_ITEM.REMOVED) ||
    (status === statusConstant.ORDER_ITEM.PENDING && orderItem.status === statusConstant.ORDER_ITEM.REMOVED)) {
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
  await order.save()

  let orderObj = order.toJSON()
  orderObj = helper.formatMoneyObj(orderObj, ['total', 'subtotal', 'ccFee', 'percentageFee', 'fixedFee'])
  const orderItems = orderObj.orderItems.map(i => helper.formatMoneyObj(i, ['price', 'total']))
  res.success({
    ...orderObj,
    orderItems,
  })
}
