module.exports = {
  BUSINESS_USER: {
    STATUS: {
      PENDING: 'PENDING',
      ACTIVATED: 'ACTIVATED'
    }
  },
  FILE: {
    PENDING: 'PENDING',
    USED: 'USED',
    DELETED: 'DELETED',
  },
  PRODUCT: {
    IN_STOCK: 1,
    OUT_OF_STOCK: 0,
  },
  ORDER: {
    NEW: 'NEW',
    PREPARING: 'PREPARING',
    PACKED: 'PACKED',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
  },
  ORDER_ITEM: {
    PENDING: 'PENDING',
    PACKED: 'PACKED',
    OUT_OF_STOCK: 'OUT_OF_STOCK',
    REMOVED: 'REMOVED',
  },
  PAYMENT_METHOD: {
    WALLET: 'WALLET',
    PAYPAL: 'PAYPAL',
    VISA: 'VISA',
    MASTERCARD: 'MASTERCARD',
    CASH: 'CASH',
  },
  STRIPE_PAYMENT_INDENT: {
    REQUIRES_CAPTURE: 'requires_capture',
    SUCCEEDED: 'succeeded',
  },
  STORE: {
    PENDING: 0,
    REJECTED: -1,
    APPROVED: 1,
  },
  BANNER: {
    ACTIVE: 1,
    INACTIVE: 0,
  },
  PAYMENT_STATUS: {
    NEW: 'new',
    COMPLETED: 'completed',
  }
}