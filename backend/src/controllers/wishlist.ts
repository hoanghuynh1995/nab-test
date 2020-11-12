import { Request, Response, NextFunction } from 'express'
import base from '../entities/base'

interface IMw1State {
  x: number
}
interface IMw2State extends IMw1State {
  y: number,
}
const testmw1 = (req: Request, res: Response, next: NextFunction) => {
  console.log('testMw')
  const state: IMw1State = {
    x: 1
  }
  req.state = state
  next()
}
const testmw2 = (req: Request, res: Response, next: NextFunction) => {
  const currentState = <IMw1State>req.state
  const state: IMw2State = {
    ...currentState,
    y: 2,
  }
  req.state = state
  next()
}

const testmw3 = (req: Request, res: Response, next: NextFunction) => {
  const currentState = <IMw2State>req.state
  console.log('state3', currentState)
  res.send(base({ res: 1 }))
}

export default {
  testmw1,
  testmw2,
  testmw3,
}