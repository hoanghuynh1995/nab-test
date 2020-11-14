"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = express_1.Router();
const _1_0_1 = __importDefault(require("./1.0"));
router.use('/v1', _1_0_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map