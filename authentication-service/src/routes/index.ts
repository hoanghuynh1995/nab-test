import { Router } from 'express'
const router = Router()

import publicRoutes from './public'
import privateRoutes from './private'

router.use('/', publicRoutes)
router.use('/priv', privateRoutes)

export default router
