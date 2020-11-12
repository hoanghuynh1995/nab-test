import { Router } from 'express'
const router = Router()

import wishlistController from '../../../controllers/wishlist'

router
  .get('/',
    wishlistController.testmw1,
    wishlistController.testmw2,
    wishlistController.testmw3,
  )

export default router

