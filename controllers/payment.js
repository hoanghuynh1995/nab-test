const db = require('../db')
const stripeService = require('../services/stripe')
const commonController = require('./common')

exports.handlePayment = async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = await stripeService.constructEvent(req.body, sig)
  } catch (err) {
    console.error('handlePayment_constructEvent', err)
    return res.error(err.message)
  }
  if (event.type !== 'payment_intent.succeeded') {
    console.error('unhandled event', event)
    return res.error(err.message)
  }
  const paymentIntent = event.data.object
  // update paymentIndent
  let orderPaymentIndent
  try {
    orderPaymentIndent = await db.OrderPaymentIndent.findOne({
      indentId: paymentIntent.id
    }).populate({
      path: 'order',
      populate: {
        path: 'orderItems',
        model: db.OrderItem,
      },
    })
  } catch (err) {
    console.error(err)
    return res.error(err.message)
  }
  if (!orderPaymentIndent) return res.error('Order payment indent not found', 400)
  orderPaymentIndent.status = paymentIntent.status
  // orderPaymentIndent.order.status = statusConstants.ORDER.PAID
  try {
    await Promise.all([
      orderPaymentIndent.save(),
      orderPaymentIndent.order.save()
    ])
  } catch (err) {
    console.error(err)
    return res.error(err.message)
  }
  commonController.sendOrderMessage(orderPaymentIndent.order.toJSON())
  res.json({ received: true })
}