const { beforeEach } = require('mocha')
const chai = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const { expect } = chai

// proxyquire
const _db = {
  Wishlist: {
    create: async data => ({
      id: Math.floor(Math.random() * 1000),
      ...data,
    }),
  }
}
const wishlistController = proxyquire('../../dist/controllers/wishlist', {
  '../db': { default: _db }
}).default

describe('Wishlist', () => {
  describe('createWishlist', async () => {
    let req, res
    beforeEach(done => {
      req = {
        state: {
          user: {
            id: 1
          }
        },
        body: {
          title: 'title',
          description: 'description',
        }
      }
      res = {
        send: sinon.stub()
      }
      _db.Wishlist.findAll = sinon.stub()
      done()
    })
    it('success create wishlist', async () => {
      try {
        await wishlistController.createWishlist(req, res)
      } catch (err) {
        expect(err).to.be.emptys
        return
      }
      expect(res.send.withArgs(sinon.match.hasNested('data.id')).calledOnce).to.be.true
    })
  })
  describe('getWishlists', async () => {
    let req, res
    beforeEach(done => {
      req = {
        state: {
          user: {
            id: 1
          }
        },
        query: {}
      }
      res = {
        send: sinon.stub()
      }
      _db.Wishlist.findAll = sinon.stub()
      done()
    })
    it('no wishlish found', async () => {
      req.state.user = -1
      try {
        await wishlistController.getWishlists(req, res)
      } catch (err) {
        expect(err).to.be.empty
        return
      }
      expect(res.send.calledOnce).to.be.true
      expect(_db.Wishlist.findAll.calledOnce).to.be.true
      expect(res.send.withArgs(sinon.match.hasNested('error.status', 1)).calledOnce).to.be.true
      expect(res.send.withArgs(sinon.match.has('data', sinon.match.falsy)).calledOnce).to.be.true
    })
  })
})