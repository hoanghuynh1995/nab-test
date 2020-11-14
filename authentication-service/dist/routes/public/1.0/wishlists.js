"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = express_1.Router();
const wishlist_1 = __importDefault(require("../../../controllers/wishlist"));
router
    .get('/', wishlist_1.default.testmw1, wishlist_1.default.testmw2, wishlist_1.default.testmw3);
exports.default = router;
//# sourceMappingURL=wishlists.js.map