import { Request, Response, NextFunction } from 'express'
import base from '../entities/base'
import { error_codes as ERROR_CODES } from '../constants'
import { Auth } from '../types/services'
import db from '../db'

interface IGetWishlistsState {
  user: Auth.VerifyTokenData
}
const getWishlists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    user
  } = <IGetWishlistsState>req.state
  let wishlists
  try {
    wishlists = await db.Wishlist.findAll({
      where: {
        user: user.id
      },
      include: [{
        model: db.WishlistItem
      }],
      raw: true
    })
  } catch (err) {
    const body = base(0, err.message, 0, ERROR_CODES.DB_QUERY)
    res.send(body)
    return
  }
  const body = base(wishlists)
  res.send(body)
}

export default {
  getWishlists,
}