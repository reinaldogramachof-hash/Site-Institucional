"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationEvents = void 0;
const events_1 = require("events");
class NotificationEmitter extends events_1.EventEmitter {
}
exports.notificationEvents = new NotificationEmitter();
