import { Router } from 'express'
const router = Router()

import validatorController, { joiObjs } from '../../../controllers/request-validation'
import userController from '../../../controllers/user'


router
  .post('/',
    validatorController.validate(joiObjs.user.createUser, 'body'),
    userController.signup,
  )
  .post('/login',
    validatorController.validate(joiObjs.user.login, 'body'),
    userController.login,
  )

export default router

