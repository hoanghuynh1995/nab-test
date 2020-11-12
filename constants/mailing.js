module.exports = {
  subjects: {
    orderPlaced: orderId => `Cart & Order - Your order ${orderId} is confirmed!`,
    orderPacked: orderId => `Cart & Order - Your order ${orderId} is packed!`,
    orderCompleted: orderId => `Cart & Order - Your order ${orderId} is completed!`,
    forgotPassword: () => `Reset Cart & Order password`,
    verifyEmail: () => `Verify Cart & Order email`,
    tempPassword: () => `Your Cart & Order password`,
  }
}
