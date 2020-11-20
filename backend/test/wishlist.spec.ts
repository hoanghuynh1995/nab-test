import 'mocha'
import chai from 'chai'
import chaiHttp from 'chai-http'
import request from 'request-promise'
// import chaiHttp = require('chai-http')
chai.use(chaiHttp)
const expect = chai.expect

import app from '../src'

const AUTH_URL = 'http://localhost:8081'

describe('Wishlist', () => {
  const userInfo = {
    email: 'huynhph@gmail.com',
    password: '123456',
    fullname: 'Huynh Phan'
  }
  let token
  let wishlistId, wishlistItemId
  before(async () => {
    // try signup first
    const signupRes = await request({
      uri: `${AUTH_URL}/v1/users`,
      method: 'POST',
      body: userInfo,
      json: true,
    })
    console.log('signupRes', signupRes)
    // login
    const loginRes = await request({
      uri: `${AUTH_URL}/v1/users/login`,
      method: 'POST',
      body: {
        email: userInfo.email,
        password: userInfo.password,
      },
      json: true,
    })
    console.log('loginRes', loginRes)
    token = loginRes.data.token
  })
  describe('POST: /v1/wishlists', () => {
    it('Create wishlist successfully', async () => {
      const body = {
        title: 'Wish list 1',
        description: 'description'
      }
      const res = await chai.request(app)
        .post('/v1/wishlists')
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.have.property('id')
      expect(res.body.data).to.have.property('title', body.title)
      expect(res.body.data).to.have.property('description', body.description)
      // assign wishlist for later test cases
      wishlistId = res.body.data.id
    })
    it('Create wishlist failed with empty body', async () => {
      const body = {}
      const res = await chai.request(app)
        .post('/v1/wishlists')
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.error.status).to.be.eq(0)
    })
  })
  describe('PUT: /v1/wishlists', () => {
    it('Edit wishlist successfully', async () => {
      const body = {
        title: 'Wish list 1 edited',
        description: 'description edited'
      }
      const res = await chai.request(app)
        .put(`/v1/wishlists/${wishlistId}`)
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.have.property('id')
      expect(res.body.data).to.have.property('title', body.title)
      expect(res.body.data).to.have.property('description', body.description)
    })
    it('Edit wishlist not found', async () => {
      const body = {
        title: 'Wish list 1 edited',
        description: 'description edited'
      }
      const res = await chai.request(app)
        .put(`/v1/wishlists/-1`)
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.error.status).to.be.eq(0)
    })
  })
  describe('POST: /v1/wishlists/wishlist_items', () => {
    const wishlistItems = [
      {
        name: 'Item 1'
      },
      {
        name: 'Item 2'
      },
    ]
    it('Create wishlist item successfully', async () => {
      const body = {
        wishlist: wishlistId,
        items: wishlistItems
      }
      const res = await chai.request(app)
        .post('/v1/wishlists/wishlist_items')
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.eq(wishlistItems.length)
      res.body.data.forEach(item => {
        expect(item).to.have.property('id')
        wishlistItemId = item.id
      })
    })
  })
  describe('PUT: /v1/wishlists/wishlist_items/:id', () => {
    it('Edit wishlist item successfully', async () => {
      const body = {
        name: 'Item 1 edited'
      }
      const res = await chai.request(app)
        .put(`/v1/wishlists/wishlist_items/${wishlistItemId}`)
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.have.property('id')
      expect(res.body.data).to.have.property('name', body.name)
    })
    it('Edit wishlist item not found', async () => {
      const body = {
        name: 'Item 1 edited'
      }
      const res = await chai.request(app)
        .put(`/v1/wishlists/wishlist_items/-1`)
        .set('Authorization', token)
        .send(body)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.error.status).to.be.eq(0)
    })
  })
  describe('GET: /v1/wishlists', () => {
    it('Get wishlist successfully', async () => {
      const res = await chai.request(app)
        .get('/v1/wishlists')
        .set('Authorization', token)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.be.an('array')
      res.body.data.forEach(p => {
        expect(p).to.have.property('id')
      })
    })
    it('Get created wishlist', async () => {
      const res = await chai.request(app)
        .get('/v1/wishlists')
        .set('Authorization', token)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.be.an('array')
      res.body.data.forEach(p => {
        expect(p).to.have.property('id')
      })
    })
  })
  describe('GET: /v1/wishlists/:id', () => {
    it('Get created wishlist', async () => {
      const res = await chai.request(app)
        .get(`/v1/wishlists/${wishlistId}`)
        .set('Authorization', token)
      expect(res).to.not.be.empty
      expect(res).to.have.status(200)
      expect(res.body.data).to.be.an('object')
      expect(res.body.data).to.have.property('id')
      expect(res.body.data.items).to.be.an('array')
    })
  })
})
