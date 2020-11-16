import { beforeEach } from 'mocha'
import * as chai from 'chai'
import sinon from 'sinon'
import proxyquire from 'proxyquire'
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const expect = chai.expect

// proxyquire
const _db = {
  Wishlist: {
  }
}
const wishlistController = proxyquire('../../dist/controllers/wishlist', {
  '../db': _db
})

let token
describe('Get Token', () => {

  describe('Signup', async () => {
    const payload = {
      email: 'test@gmail.com',
      password: '123456',
      fullname: 'Test Name'
    }
    it('Empty email', async done => {
      const errPayload = {
        ...payload,
        email: undefined,
      }
      console.log('errPayload', errPayload)
      const wistlists = await chai.request(server).get('/v1/wishlists')
      console.log(wistlists)
      done()
    })
  })
  it('/login', async done => {
    console.log('login')
    token = 'token'
    done()
  })
})
describe('Wishlist', () => {
  describe('getWishlists', async () => {
    let req, res
    beforeEach(done => {
      req = {
        state: {
          user: {
            id: 1
          }
        }
      }
      res = {
        send: sinon.stub()
      }
      _db.Wishlist.findAll = sinon.stub()
      done()
    })
    it('no wishlish found', async done => {
      req.state.user = -1
      res.send.calledOnce()
      _db.Wishlist.findAll.calledOnce()
      done()
    })
  })
  it('GET: /wishlists', async done => {
    console.log('GET: /wishlists', {
      token
    })
    done()
  })
})