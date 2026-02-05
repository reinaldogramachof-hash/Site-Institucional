#!/bin/bash
# Script de Deploy - Plena Chatbot Cloud (Versão Linux/Cloud Shell)

# 1. Configurações
PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
    echo "Erro: Não foi possível obter o Project ID. Autentique-se com 'gcloud auth login' ou defina o projeto."
    exit 1
fi

echo "Iniciando Deploy para o Projeto: $PROJECT_ID"

# 2. Build das Imagens
echo "--- Passo 1: Build das Imagens Docker ---"
docker build -t "gcr.io/$PROJECT_ID/chatbot-backend" ./cloud-app/backend
docker build -f cloud-app/frontend/Dockerfile -t "gcr.io/$PROJECT_ID/chatbot-frontend" .

# 3. Push para o Container Registry
echo "--- Passo 2: Enviando Imagens para o GCR ---"
docker push "gcr.io/$PROJECT_ID/chatbot-backend"
docker push "gcr.io/$PROJECT_ID/chatbot-frontend"

# 4. Terraform Apply
echo "--- Passo 3: Aplicando Infraestrutura com Terraform ---"
terraform init
terraform apply -var="project_id=$PROJECT_ID" -auto-approve

echo "Deploy Concluído com Sucesso! ✅"
echo "Verifique o Load Balancer no Console do GCP para acessar a URL final."
