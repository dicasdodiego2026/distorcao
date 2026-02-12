import fs from 'fs';
import { parseLogData } from './src/utils/calculations.js';

const mesFilePath = 'c:\\Users\\admin\\Desktop\\AAexpoDistorcaoMediaFiltrosATM  Strategy\\DADOS MES\\@MES_M1_dezembro 2025.csv';

try {
    const content = fs.readFileSync(mesFilePath, 'utf8');
    console.log(`📂 Lendo arquivo: ${mesFilePath}`);

    // Simulate what the frontend does (it passes the file content string)
    // Note: parseLogData in calculations.js checks for <DATE> to route to parseCSVData

    const bars = parseLogData(content);

    if (bars.length > 0) {
        console.log(`✅ Parseado com sucesso: ${bars.length} barras.`);
        console.log(`📏 Tick Size Detectado: ${bars[0].tick_size}`);

        // Validation
        if (bars[0].tick_size === 0.25) {
            console.log("✅ SUCESSO: Tick Size 0.25 detectado corretamente para MES.");
        } else {
            console.error(`❌ FALHA: Tick Size deveria ser 0.25, mas foi ${bars[0].tick_size}`);
        }

        // Check a few prices to ensure they align
        console.log("Amostra de dados:", bars.slice(0, 3));
    } else {
        console.error("❌ FALHA: Nenhuma barra retornada.");
    }

} catch (err) {
    console.error("Erro ao ler/processar arquivo:", err);
}
