"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPDFService = getPDFService;
const pdfkit_1 = __importDefault(require("pdfkit"));
const templates = ['modern', 'classic', 'creative'];
function buildModern(doc, title, d) {
    doc.fontSize(22).text(title);
    doc.moveDown();
    doc.fontSize(12).text(`Nome: ${d.nome}`);
    doc.text(`Cargo: ${d.cargo}`);
    doc.text(`Email: ${d.email}`);
    doc.text(`Telefone: ${d.tel}`);
    if (d.cidade)
        doc.text(`Cidade: ${d.cidade}`);
    if (d.resumo) {
        doc.moveDown();
        doc.text(d.resumo);
    }
    if (d.empresa)
        doc.moveDown();
    if (d.empresa)
        doc.text(`Empresa: ${d.empresa}`);
    if (d.periodo)
        doc.text(`Período: ${d.periodo}`);
    if (d.atividades) {
        doc.moveDown();
        doc.text(d.atividades);
    }
}
function buildClassic(doc, title, d) {
    doc.fontSize(18).text(title);
    doc.moveDown();
    doc.fontSize(12).text(d.nome);
    doc.text(d.cargo);
    doc.text(d.email);
    doc.text(d.tel);
    if (d.cidade)
        doc.text(d.cidade);
    if (d.resumo) {
        doc.moveDown();
        doc.text(d.resumo);
    }
    if (d.empresa)
        doc.moveDown();
    if (d.empresa)
        doc.text(d.empresa);
    if (d.periodo)
        doc.text(d.periodo);
    if (d.atividades) {
        doc.moveDown();
        doc.text(d.atividades);
    }
}
class DefaultPDFService {
    async generateCurriculum(data, template) {
        const doc = new pdfkit_1.default();
        const chunks = [];
        doc.on('data', d => chunks.push(d));
        const title = `${data.nome} - ${data.cargo}`;
        if (template === 'classic')
            buildClassic(doc, title, data);
        else
            buildModern(doc, title, data);
        await new Promise(resolve => { doc.on('end', () => resolve()); doc.end(); });
        return Buffer.concat(chunks);
    }
    validateTemplate(template) { return templates.includes(template); }
    getAvailableTemplates() { return templates; }
}
function getPDFService() { return new DefaultPDFService(); }
