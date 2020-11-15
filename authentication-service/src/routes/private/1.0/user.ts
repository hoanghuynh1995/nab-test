import { Router } from 'express'
const router = Router()

import validatorController, { joiObjs } from '../../../controllers/request-validation'
import userController from '../../../controllers/user'


router
  .post('/verify_token',
    validatorController.validate(joiObjs.user.verifyToken, 'body'),
    userController.verifyToken,
  )

export default router

