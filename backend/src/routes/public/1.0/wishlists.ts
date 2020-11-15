import { Router } from 'express'
const router = Router()

import validatorController, { joiObjs } from '../../../controllers/request-validation'
import userController from '../../../controllers/user'
import wishlistController from '../../../controllers/wishlist'

router
  .get('/',
    validatorController.validate(joiObjs.wishlist.get, 'query'),
    userController.auth,
    wishlistController.getWishlists
  )
  .post('/',
    validatorController.validate(joiObjs.wishlist.create, 'body'),
    userController.auth,
    wishlistController.createWishlist
  )
  .post('/wishlist_items',
    validatorController.validate(joiObjs.wishlist.addItem, 'body'),
    userController.auth,
    wishlistController.createWishlistItem
  )

export default router

