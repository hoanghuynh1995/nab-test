import { Router } from 'express'
const router = Router()

import userController from '../../../controllers/user'
import wishlistController from '../../../controllers/wishlist'

router
  .get('/',
    userController.auth,
    wishlistController.getWishlists
  )

export default router

