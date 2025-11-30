"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongo = connectMongo;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
async function connectMongo() {
    if (!env_1.env.MONGO_URI)
        return;
    await mongoose_1.default.connect(env_1.env.MONGO_URI);
}
