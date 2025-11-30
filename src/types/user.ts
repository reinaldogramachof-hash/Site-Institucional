export type User = {
  id: string
  email: string
  name: string
  phone?: string
  cpf?: string
  cnpj?: string
  type?: 'customer' | 'admin'
}