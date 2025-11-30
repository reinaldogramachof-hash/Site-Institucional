import PDFDocument from 'pdfkit'
import { CurriculumData } from '../types/curriculum'

export interface PDFService {
  generateCurriculum(data: CurriculumData, template: string): Promise<Buffer>
  validateTemplate(template: string): boolean
  getAvailableTemplates(): string[]
}

const templates = ['modern', 'classic', 'creative']

function buildModern(doc: any, title: string, d: CurriculumData) {
  doc.fontSize(22).text(title)
  doc.moveDown()
  doc.fontSize(12).text(`Nome: ${d.nome}`)
  doc.text(`Cargo: ${d.cargo}`)
  doc.text(`Email: ${d.email}`)
  doc.text(`Telefone: ${d.tel}`)
  if (d.cidade) doc.text(`Cidade: ${d.cidade}`)
  if (d.resumo) { doc.moveDown(); doc.text(d.resumo) }
  if (d.empresa) doc.moveDown()
  if (d.empresa) doc.text(`Empresa: ${d.empresa}`)
  if (d.periodo) doc.text(`Período: ${d.periodo}`)
  if (d.atividades) { doc.moveDown(); doc.text(d.atividades) }
}

function buildClassic(doc: any, title: string, d: CurriculumData) {
  doc.fontSize(18).text(title)
  doc.moveDown()
  doc.fontSize(12).text(d.nome)
  doc.text(d.cargo)
  doc.text(d.email)
  doc.text(d.tel)
  if (d.cidade) doc.text(d.cidade)
  if (d.resumo) { doc.moveDown(); doc.text(d.resumo) }
  if (d.empresa) doc.moveDown()
  if (d.empresa) doc.text(d.empresa)
  if (d.periodo) doc.text(d.periodo)
  if (d.atividades) { doc.moveDown(); doc.text(d.atividades) }
}

class DefaultPDFService implements PDFService {
  async generateCurriculum(data: CurriculumData, template: string) {
    const doc = new PDFDocument()
    const chunks: Buffer[] = []
    doc.on('data', d => chunks.push(d))
    const title = `${data.nome} - ${data.cargo}`
    if (template === 'classic') buildClassic(doc, title, data)
    else buildModern(doc, title, data)
    await new Promise<void>(resolve => { doc.on('end', () => resolve()); doc.end() })
    return Buffer.concat(chunks)
  }
  validateTemplate(template: string) { return templates.includes(template) }
  getAvailableTemplates() { return templates }
}

export function getPDFService(): PDFService { return new DefaultPDFService() }