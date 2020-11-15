/**
 * Types for auth service
 */

export interface Request {
  token: string
}

export interface Response {
  id: string,
  email: string,
  fullname: string,
  createdAt: Date,
  updatedAt: Date,
  iat: number,
  exp: number
}
