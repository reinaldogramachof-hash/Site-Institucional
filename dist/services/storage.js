"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageService = getStorageService;
const client_s3_1 = require("@aws-sdk/client-s3");
const env_1 = require("../config/env");
class InMemoryFileStorage {
    constructor() {
        this.store = new Map();
    }
    async uploadPDF(buffer, filename) { this.store.set(filename, buffer); return `memory://${filename}`; }
    async uploadFile(buffer, filename, contentType) { this.store.set(filename, buffer); return `memory://${filename}`; }
    async deleteFile(fileUrl) { const key = fileUrl.replace('memory://', ''); this.store.delete(key); }
    async getSignedUrl(fileUrl) { return fileUrl; }
}
class S3FileStorage {
    constructor(region, bucket, domain) { this.region = region; this.bucket = bucket; this.domain = domain; this.s3 = new client_s3_1.S3Client({ region }); }
    async uploadPDF(buffer, filename) {
        await this.s3.send(new client_s3_1.PutObjectCommand({ Bucket: this.bucket, Key: filename, Body: buffer, ContentType: 'application/pdf', ACL: 'private' }));
        if (this.domain)
            return `https://${this.domain}/${filename}`;
        return `https://s3.${this.region}.amazonaws.com/${this.bucket}/${filename}`;
    }
    async uploadFile(buffer, filename, contentType) {
        await this.s3.send(new client_s3_1.PutObjectCommand({ Bucket: this.bucket, Key: filename, Body: buffer, ContentType: contentType || 'application/octet-stream', ACL: 'private' }));
        if (this.domain)
            return `https://${this.domain}/${filename}`;
        return `https://s3.${this.region}.amazonaws.com/${this.bucket}/${filename}`;
    }
    async deleteFile(fileUrl) {
        const u = new URL(fileUrl);
        const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        await this.s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
    async getSignedUrl(fileUrl) {
        const u = new URL(fileUrl);
        const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        const { getSignedUrl } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/s3-request-presigner')));
        const cmd = new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: key });
        return await getSignedUrl(this.s3, cmd, { expiresIn: 3600 });
    }
}
function getStorageService() {
    if (env_1.env.AWS_REGION && env_1.env.AWS_S3_BUCKET)
        return new S3FileStorage(env_1.env.AWS_REGION, env_1.env.AWS_S3_BUCKET, env_1.env.CLOUDFRONT_DOMAIN || undefined);
    return new InMemoryFileStorage();
}
