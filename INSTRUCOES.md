# Aplicação de Análise de Distorção

Esta aplicação Web foi criada com React e Vite para analisar os logs gerados pelo indicador NinjaTrader.

## Tecnologias Utilizadas
- **React** (Vite)
- **Tailwind CSS** (Estilização)
- **Recharts** (Gráficos)
- **React Dropzone** (Upload de arquivos)

## Como Rodar Localmente

1. Abra o terminal na pasta `distorcao-app`:
   ```bash
   cd distorcao-app
   ```

2. Instale as dependências (caso ainda não tenha feito):
   ```bash
   npm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse o link exibido (ex: `http://localhost:5173`) no seu navegador.

## Como Enviar para o GitHub

Execute os seguintes comandos no terminal dentro da pasta `distorcao-app`:

```bash
git init
git add .
git commit -m "Primeiro commit - App de Analise"
git branch -M main
git remote add origin https://github.com/dicasdodiego2026/distorcao.git
git push -u origin main
```

**Nota:** Se o repositório já tiver arquivos (como README criado pelo GitHub), você pode precisar usar `git pull origin main --allow-unrelated-histories` antes do push, ou usar `git push -f origin main` (cuidado, isso sobrescreve o remoto).

## Como Deployar na Vercel

1. Crie uma conta na [Vercel](https://vercel.com).
2. Clique em "Add New..." -> "Project".
3. Importe o repositório do GitHub (`distorcao`).
4. A Vercel detectará automaticamente que é um projeto Vite.
5. Clique em "Deploy".

## Funcionalidades
- Upload de múltiplos arquivos de log (.json, .txt).
- Cálculo automático de SMA 10, 25, 50.
- Gráfico de Distorção (Histograma) para identificar frequências.
- Scatter Plot (Distorção vs Retorno Futuro) para encontrar padrões de reversão.
- Gráfico de Preço com Médias Móveis.
