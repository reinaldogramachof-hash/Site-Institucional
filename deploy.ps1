# Script de Deploy - Plena Chatbot Cloud
# Execute este script em um terminal com Google Cloud SDK e Terraform instalados e autenticados.

# 1. Configurações
$PROJECT_ID = gcloud config get-value project
if (-not $PROJECT_ID) {
    Write-Host "Erro: Não foi possível obter o Project ID do gcloud. Autentique-se primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando Deploy para o Projeto: $PROJECT_ID" -ForegroundColor Cyan

# 2. Build das Imagens
Write-Host "--- Passo 1: Build das Imagens Docker ---" -ForegroundColor Yellow
docker build -t "gcr.io/$PROJECT_ID/chatbot-backend" ./cloud-app/backend
docker build -f cloud-app/frontend/Dockerfile -t "gcr.io/$PROJECT_ID/chatbot-frontend" .

# 3. Push para o Container Registry
Write-Host "--- Passo 2: Enviando Imagens para o GCR ---" -ForegroundColor Yellow
docker push "gcr.io/$PROJECT_ID/chatbot-backend"
docker push "gcr.io/$PROJECT_ID/chatbot-frontend"

# 4. Terraform Apply
Write-Host "--- Passo 3: Aplicando Infraestrutura com Terraform ---" -ForegroundColor Yellow
terraform init
terraform apply -var="project_id=$PROJECT_ID" -auto-approve

Write-Host "Deploy Concluído! Verifique o Load Balancer no Console do Google Cloud." -ForegroundColor Green
