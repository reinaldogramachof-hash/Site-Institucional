const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { PredictionServiceClient } = require('@google-cloud/aiplatform').v1;
const { helpers } = require('@google-cloud/aiplatform');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO CLOUD SQL ---
// As variáveis de ambiente serão injetadas pelo Cloud Run via Terraform
const dbConfig = {
    user: process.env.DB_USER || 'chatbot_user', // Criado via Terraform (var.db_username?)
    password: process.env.DB_PASSWORD, // Injetado via Secret Manager
    database: process.env.DB_NAME || 'chatbot_db',
    host: process.env.DB_HOST, // IP do Cloud SQL ou Socket
    port: 5432,
    // Se usar socket Unix (comum em Cloud Run):
    // host: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`
};

// Ajuste para conexão via Socket se disponível
if (process.env.CLOUD_SQL_CONNECTION_NAME) {
    dbConfig.host = `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`;
    delete dbConfig.port; // Porta não usada em socket unix
}

const pool = new Pool(dbConfig);

// --- CONFIGURAÇÃO VERTEX AI ---
const projectId = process.env.PROJECT_ID;
const location = 'us-central1';
const publisher = 'google';
const model = 'chat-bison@001'; // Ou Gemini Pro se disponível

const clientOptions = {
    apiEndpoint: `${location}-aiplatform.googleapis.com`,
};

const predictionServiceClient = new PredictionServiceClient(clientOptions);

// --- ROTAS ---

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Endpoint principal de Chat
app.post('/api/chat', async (req, res) => {
    const { message, context, userId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // 1. Logar mensagem do usuário no SQL
        await logConversation(userId, 'user', message);

        // 2. Chamar Vertex AI
        const botResponse = await callVertexAI(message, context);

        // 3. Logar resposta do bot no SQL
        await logConversation(userId, 'bot', botResponse);

        res.json({ response: botResponse });

    } catch (error) {
        console.error('Error processing chat:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// --- FUNÇÕES AUXILIARES ---

async function logConversation(userId, sender, text) {
    try {
        // Cria tabela se não existir (apenas para dev/poc, ideal é via migration)
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS chat_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255),
                sender VARCHAR(50),
                message TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await pool.query(createTableQuery);

        // Insere log
        const insertQuery = 'INSERT INTO chat_logs (user_id, sender, message) VALUES ($1, $2, $3)';
        await pool.query(insertQuery, [userId || 'anonymous', sender, text]);

    } catch (err) {
        console.error('Failed to log to Cloud SQL:', err);
        // Não falha a requisição do chat se o log falhar, apenas avisa
    }
}

async function callVertexAI(prompt, userContext) {
    // Configuração do Prompt
    // Em produção, isso deve ser mais elaborado com instruções de sistema sobre a Plena Informática
    const endpoint = `projects/${projectId}/locations/${location}/publishers/${publisher}/models/${model}`;

    const instanceValue = helpers.toValue({
        context: "Você é o assistente virtual da Plena Informática. Responda de forma curta, amigável e incentive o contato via WhatsApp para serviços complexos.",
        examples: [],
        messages: [
            { author: "user", content: prompt }
        ]
    });

    const instances = [instanceValue];

    const parameterValue = helpers.toValue({
        temperature: 0.2,
        maxOutputTokens: 256,
        topP: 0.95,
        topK: 40,
    });

    const request = {
        endpoint,
        instances,
        parameters: parameterValue,
    };

    try {
        const [response] = await predictionServiceClient.predict(request);
        const prediction = response.predictions[0];
        // Parse da resposta do Bison/Gemini
        // A estrutura exata depende do modelo, ajustando para chat-bison padrão:
        const content = prediction?.structValue?.fields?.candidates?.listValue?.values?.[0]?.structValue?.fields?.content?.stringValue;
        return content || "Desculpe, não consegui processar sua solicitação no momento. Tente novamente.";

    } catch (err) {
        console.error("Vertex AI Error:", err);
        return "Estou com dificuldades de conexão com minha inteligência. Por favor, fale no WhatsApp.";
    }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Chatbot Backend listening on port ${PORT}`);
});
