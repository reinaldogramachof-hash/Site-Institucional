import { EventEmitter } from 'events'

class NotificationEmitter extends EventEmitter {}

export const notificationEvents = new NotificationEmitter()