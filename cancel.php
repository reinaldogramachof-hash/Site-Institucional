<?php
/**
 * cancel.php — Página exibida quando o pagamento é cancelado ou falha.
 * Nenhum valor é cobrado nesta situação.
 */
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pagamento não concluído | Plena Informática</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #0A0A0F;
        }
    </style>
</head>

<body class="min-h-screen flex items-center justify-center px-4 bg-[#0A0A0F]">

    <div class="max-w-md w-full text-center">

        <!-- Ícone -->
        <div
            class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-900/30 border border-red-700/40 mb-6">
            <i class="ph ph-x-circle text-5xl text-red-400"></i>
        </div>

        <!-- Título -->
        <h1 class="text-3xl font-bold text-white mb-3">Pagamento não concluído</h1>
        <p class="text-gray-400 text-base mb-2">Nenhum valor foi cobrado.</p>
        <p class="text-gray-500 text-sm mb-8">
            Se você teve alguma dificuldade, entre em contato pelo WhatsApp e
            resolveremos rapidinho. 😊
        </p>

        <!-- Botões de ação -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center">

            <!-- Tentar novamente -->
            <a href="tecnologia.html#sistemas" class="inline-flex items-center justify-center gap-2
                bg-emerald-600 hover:bg-emerald-500 text-black font-bold
                px-6 py-3 rounded-xl transition-colors">
                <i class="ph ph-arrow-counter-clockwise text-lg"></i>
                Tentar novamente
            </a>

            <!-- WhatsApp -->
            <a href="https://wa.me/5512992191018?text=Ol%C3%A1!%20Tive%20problema%20no%20pagamento%20do%20sistema%20e%20preciso%20de%20ajuda."
                target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2
                bg-white/5 hover:bg-white/10 border border-white/10
                text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                <i class="ph ph-whatsapp-logo text-lg text-emerald-400"></i>
                Falar no WhatsApp
            </a>

        </div>

        <!-- Rodapé -->
        <p class="text-gray-600 text-xs mt-10">
            Plena Informática · São José dos Campos · SP
        </p>

    </div>

</body>

</html>