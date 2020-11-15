"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = express_1.Router();
const public_1 = __importDefault(require("./public"));
const private_1 = __importDefault(require("./private"));
router.use('/', public_1.default);
router.use('/priv', private_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map