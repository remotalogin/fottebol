let detectedPatterns = {};
let selectedPattern = '';
let selectedCard = '';
let history = [];
let cardAnalysisGlobal = {};
let lastHistory = [];
let loading = false;

// --- Funções Principais de Carregamento e Análise ---

async function loadData() {
    if (loading) {
        return;
    }
    loading = true;
    const timeout = setTimeout(() => {
        loading = false;
    }, 3000);

    try {
        const readQuantity = parseInt(document.getElementById("quantidade").value);
        const patternSize = parseInt(document.getElementById("tamanho-padrao").value);
        const response = await fetch("https://api.jogosvirtual.com/jsons/historico_baralho_footballstudio.json?_=" + Date.now(), {
            'cache': "no-store"
        });

        if (!response.ok) {
            throw new Error("Erro: " + response.status + " - " + response.statusText);
        }

        const rawData = await response.text();
        let parsedData;
        try {
            parsedData = JSON.parse(rawData);
        } catch (error) {
            return;
        }

        if (!parsedData.baralhos || Object.keys(parsedData.baralhos).length === 0) {
            return;
        }

        let combinedData = [];
        Object.keys(parsedData.baralhos).forEach(deckKey => {
            combinedData = combinedData.concat(parsedData.baralhos[deckKey]);
        });

        if (combinedData.length === 0) {
            return;
        }

        // Atualiza os dados principais e históricos
        history = combinedData.slice(-readQuantity);
        const history1000 = combinedData.slice(-1000);
        const originalData = combinedData.slice(-300).map(item => item.charAt(0));

        // Analisa e exibe os dados
        updateMaxStreaks(history);
        detectedPatterns = detectPatterns(history, patternSize);
        showPatterns(detectedPatterns);
        analyzeCards(history);
        const visualPatterns = detectVisualPatterns(history);
        suggestEntryIA(history, visualPatterns);
        updateSuggestions(history);

        if (lastHistory.length === 0) {
            drawHistory(history);
            lastHistory = [...history.slice(-10)];
        }

    } catch (error) {
        console.error("❌ Erro ao carregar os dados:", error);
    } finally {
        clearTimeout(timeout);
        loading = false;
    }
}

// Atualiza as sugestões de cores e cartas
function updateSuggestions(historyData) {
    let [martingaleSuggestion, martingalePattern] = getMartingaleSuggestion(historyData);
    let martingaleOccurrences = detectedPatterns[martingalePattern]?.["ocorrencias"] || 0;
    let martingaleColor = martingaleSuggestion.includes('🔵') ? '🔵' : martingaleSuggestion.includes('🔴') ? '🔴' : martingaleSuggestion.includes('🟠') ? '🟠' : '';
    let martingalePercent = martingaleSuggestion.match(/\((.*?)\)/)?.[1] || '';
    let martingaleHtml = martingaleColor && martingalePercent ? `🎯 Sugestão Cores: <strong>${martingaleColor} ${martingaleOccurrences} (${martingalePercent})</strong>` : "🎯 Sugestão Cores: <strong>Buscando Padrão...</strong>";
    document.getElementById('martingale-result').innerHTML = martingaleHtml;

    suggestEntry(historyData, cardAnalysisGlobal);
}

// Carrega os dados na inicialização e a cada 5 segundos
document.addEventListener("DOMContentLoaded", loadData);
setInterval(loadData, 5000);

// Atualiza o histórico a cada 1 segundo (não recarrega dados, apenas redesenha se houver novo item)
function updateHistory() {
    const latestHistory = history.slice(-10);
    const hasNewEntry = latestHistory.length !== lastHistory.length || latestHistory.some((entry, index) => entry !== lastHistory[index]);
    if (hasNewEntry) {
        drawHistory(history);
        lastHistory = [...latestHistory];
    }
}
setInterval(updateHistory, 1000);


// --- Funções de Seleção e Desenho ---

function drawHistory(historyData, highlight = {}) {
    const dataContainer = document.getElementById('dados');
    if (!dataContainer) return;
    dataContainer.innerHTML = '';
    
    let highlightIndices = [];
    let patternLength = 1;
    let suggestedBet = null;
    
    if (highlight.type === 'pattern' && highlight.value) {
        patternLength = highlight.value.length;
        highlightIndices = findPatternIndices(historyData, highlight.value);
        suggestedBet = highlight.suggestedBet;
    } else if (highlight.type === 'card' && highlight.value) {
        highlightIndices = findCardIndices(historyData, highlight.value);
        suggestedBet = highlight.suggestedBet;
    } else if (highlight.type === 'visual' && highlight.indices) {
        patternLength = highlight.patternLength;
        highlightIndices = highlight.indices;
        suggestedBet = highlight.suggestedBet;
    }

    historyData.forEach((item, index) => {
        const char = item.charAt(0);
        const value = item.match(/\((.*?)\)/)?.[1] || '';
        const colorClass = char === 'V' ? "banker" : char === 'A' ? 'player' : 'tie';
        const circle = document.createElement('div');
        circle.classList.add("circle", colorClass);
        circle.textContent = value;
        let isHighlighted = false;

        highlightIndices.forEach(highlightIndex => {
            const nextBet = historyData[highlightIndex + patternLength]?.charAt(0);
            const nextBetG1 = historyData[highlightIndex + patternLength + 1]?.charAt(0);
            const nextBetG2 = historyData[highlightIndex + patternLength + 2]?.charAt(0);
            
            if (index >= highlightIndex && index < highlightIndex + patternLength) {
                circle.classList.add('padrao');
                isHighlighted = true;
            } else if (index === highlightIndex + patternLength) {
                circle.classList.add(nextBet === suggestedBet || nextBet === 'T' ? "green1" : "highlight2");
                isHighlighted = true;
            } else if (index === highlightIndex + patternLength + 1) {
                if (nextBet === suggestedBet || nextBet === 'T') {
                    circle.classList.add("apagado");
                } else {
                    circle.classList.add(nextBetG1 === suggestedBet || nextBetG1 === 'T' ? "green1" : "highlight2");
                }
                isHighlighted = true;
            } else if (index === highlightIndex + patternLength + 2) {
                if (nextBet === suggestedBet || nextBet === 'T' || nextBetG1 === suggestedBet || nextBetG1 === 'T') {
                    circle.classList.add('apagado');
                } else {
                    circle.classList.add(nextBetG2 === suggestedBet || nextBetG2 === 'T' ? 'green1' : "highlight2");
                }
                isHighlighted = true;
            }
        });

        if (!isHighlighted && Object.keys(highlight).length > 0) {
            circle.classList.add("apagado");
        }
        dataContainer.appendChild(circle);
    });
}

function findPatternIndices(historyData, pattern) {
    const indices = [];
    const patternLength = pattern.length;
    for (let i = 0; i <= historyData.length - patternLength - 3; i++) {
        const currentPattern = historyData.slice(i, i + patternLength).map(item => item.charAt(0)).join('');
        if (currentPattern === pattern) {
            indices.push(i);
        }
    }
    return indices;
}

function findCardIndices(historyData, card) {
    const indices = [];
    for (let i = 0; i <= historyData.length - 4; i++) {
        const currentCard = historyData[i].charAt(0) + '(' + (historyData[i].match(/\((.*?)\)/)?.[1] || '?') + ')';
        if (currentCard === card) {
            indices.push(i);
        }
    }
    return indices;
}

function selectPattern(pattern) {
    const stats = getPatternStats(pattern);
    const suggestedBet = stats?.melhorOpcao;
    drawHistory(history, { type: 'pattern', value: pattern, suggestedBet: suggestedBet });
}

function selectCardForAnalysis(card) {
    const stats = cardAnalysisGlobal[card];
    let suggestedBet = 'V';
    if (stats) {
        const vGreens = stats.green1V + stats.greenG1V + stats.greenG2V;
        const aGreens = stats.green1A + stats.greenG1A + stats.greenG2A;
        if (aGreens > vGreens) {
            suggestedBet = 'A';
        } else if (vGreens > aGreens) {
            suggestedBet = 'V';
        } else {
            suggestedBet = stats.appearedA > stats.appearedV ? 'A' : 'V';
        }
    }
    drawHistory(history, { type: 'card', value: card, suggestedBet: suggestedBet });
}

function drawVisualPattern(pattern, highlightIndices, suggestedBet) {
    const patternLength = pattern.split(',').length;
    drawHistory(history, { type: 'visual', value: pattern, indices: highlightIndices, patternLength: patternLength, suggestedBet: suggestedBet });
}

function clearHighlights() {
    drawHistory(history, {});
}

// --- Funções de Análise e Estatísticas ---

function getPatternStats(pattern) {
    const patternSize = parseInt(document.getElementById("tamanho-padrao").value);

    if (!detectedPatterns[pattern]) {
        return;
    }
    const nextOutcomes = detectedPatterns[pattern].proximos;
    let bestOption = null;
    let bestRate = -1;

    Object.keys(nextOutcomes).forEach(outcome => {
        let totalCount = 0;
        let totalGreens = 0;
        for (let i = 0; i <= history.length - patternSize; i++) {
            const currentPattern = history.slice(i, i + patternSize).map(item => item.charAt(0)).join('');
            if (currentPattern !== pattern) continue;
            const nextChar = history[i + patternSize]?.charAt(0);
            const nextCharG1 = history[i + patternSize + 1]?.charAt(0);
            const nextCharG2 = history[i + patternSize + 2]?.charAt(0);
            if (!nextChar || !nextCharG1 || !nextCharG2) continue;
            totalCount++;
            if (nextChar === outcome || nextChar === 'T') {
                totalGreens++;
            } else if (nextCharG1 === outcome || nextCharG1 === 'T') {
                totalGreens++;
            } else if (nextCharG2 === outcome || nextCharG2 === 'T') {
                totalGreens++;
            }
        }
        const successRate = totalCount > 0 ? totalGreens / totalCount * 100 : 0;
        if (successRate > bestRate) {
            bestRate = successRate;
            bestOption = outcome;
        }
    });

    if (!bestOption) return;

    let green1 = 0;
    let greenG1 = 0;
    let greenG2 = 0;
    let red = 0;
    let totalOccurrences = 0;
    for (let i = 0; i <= history.length - patternSize; i++) {
        const currentPattern = history.slice(i, i + patternSize).map(item => item.charAt(0)).join('');
        if (currentPattern !== pattern) continue;
        const nextChar = history[i + patternSize]?.charAt(0);
        const nextCharG1 = history[i + patternSize + 1]?.charAt(0);
        const nextCharG2 = history[i + patternSize + 2]?.charAt(0);
        if (!nextChar || !nextCharG1 || !nextCharG2) continue;
        totalOccurrences++;
        if (nextChar === bestOption || nextChar === 'T') {
            green1++;
        } else if (nextCharG1 === bestOption || nextCharG1 === 'T') {
            greenG1++;
        } else if (nextCharG2 === bestOption || nextCharG2 === 'T') {
            greenG2++;
        } else {
            red++;
        }
    }
    const finalRate = totalOccurrences > 0 ? (green1 + greenG1 + greenG2) / totalOccurrences * 100 : 0;
    return { 'melhorOpcao': bestOption, 'melhorTaxa': finalRate, green1, greenG1, greenG2, red, 'total': totalOccurrences };
}

function getMartingaleSuggestion(historyData) {
    const minPatternSize = parseInt(document.getElementById("tamanho-padrao").value);
    const minAccuracy = parseInt(document.getElementById("percentualAcerto").value);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.value);
    const lastPattern = historyData.slice(-minPatternSize).map(item => item.charAt(0)).join('');
    const patternStats = detectedPatterns[lastPattern];

    if (!patternStats || patternStats.ocorrencias < minOccurrences) {
        return ["Buscando Padrão...", ''];
    }
    const stats = getPatternStats(lastPattern);
    if (!stats || stats.melhorTaxa < minAccuracy) {
        return ["Buscando Padrão...", ''];
    }
    const suggestedColor = stats.melhorOpcao === 'V' ? '🔴' : stats.melhorOpcao === 'A' ? '🔵' : '🟠';
    const suggestionText = suggestedColor + " " + patternStats.ocorrencias + " (" + stats.melhorTaxa.toFixed(2) + '%)';
    return [suggestionText, lastPattern];
}

function detectPatterns(historyData, size) {
    const patterns = {};
    for (let i = 0; i < historyData.length - size; i++) {
        const patternKey = historyData.slice(i, i + size).map(item => item.charAt(0)).join('');
        const nextOutcome = historyData[i + size]?.charAt(0) || '?';
        if (!patterns[patternKey]) {
            patterns[patternKey] = { 'ocorrencias': 0, 'proximos': {} };
        }
        patterns[patternKey].ocorrencias++;
        patterns[patternKey].proximos[nextOutcome] = (patterns[patternKey].proximos[nextOutcome] || 0) + 1;
    }
    return patterns;
}

function updateMaxStreaks(historyData) {
    let maxV = 0, maxA = 0, maxT = 0, maxWithoutT = 0;
    let currentV = 0, currentA = 0, currentT = 0, currentWithoutT = 0;
    for (const entry of historyData) {
        const char = entry.charAt(0);
        if (char === 'V') {
            currentV++; maxV = Math.max(maxV, currentV);
            currentA = 0; currentT = 0; currentWithoutT++;
        } else if (char === 'A') {
            currentA++; maxA = Math.max(maxA, currentA);
            currentV = 0; currentT = 0; currentWithoutT++;
        } else if (char === 'T') {
            currentT++; maxT = Math.max(maxT, currentT);
            currentV = 0; currentA = 0;
            maxWithoutT = Math.max(maxWithoutT, currentWithoutT);
            currentWithoutT = 0;
        }
    }
    document.getElementById("result-v").innerHTML = `Máxima de 🔴 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxV}</strong>`;
    document.getElementById("result-a").innerHTML = `Máxima de 🔵 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxA}</strong>`;
    document.getElementById("result-t").innerHTML = `Máxima de 🟠 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxT}</strong>`;
    document.getElementById("result-no-t").innerHTML = `Máxima sem 🟠 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxWithoutT}</strong>`;
}

function showPatterns(patterns) {
    let html = '';
    const minAccuracy = parseInt(document.getElementById("percentualAcerto").value);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.value);
    const strongPatterns = [];
    Object.keys(patterns).forEach(pattern => {
        const stats = getPatternStats(pattern);
        const occurrences = patterns[pattern].ocorrencias;
        if (!stats || occurrences < minOccurrences || stats.melhorTaxa < minAccuracy) {
            return;
        }
        strongPatterns.push({ 'pattern': pattern, 'stats': stats, 'totalOccurrences': occurrences, 'bestRate': stats.melhorTaxa });
    });
    strongPatterns.sort((a, b) => b.bestRate - a.bestRate || b.totalOccurrences - a.totalOccurrences);
    strongPatterns.forEach(patternData => {
        const { pattern, stats, totalOccurrences } = patternData;
        const suggestedColor = stats.melhorOpcao === 'V' ? '🔴' : stats.melhorOpcao === 'A' ? '🔵' : '🟠';
        const formattedRate = suggestedColor + " (" + stats.melhorTaxa.toFixed(2) + '%)';
        const patternDisplay = pattern.split('').map(char => `<span class="circle ${char === 'V' ? 'banker' : char === 'A' ? 'player' : 'tie'}"></span>`).join(" ");
        html += `
            <div class="row pt-3 pb-3 justify-content-center" onclick="selectPattern('${pattern}')">
                <div class="col-xl-3 col-md-4 d-flex flex-wrap gap-xl-1 justify-content-lg-start justify-content-center ">${patternDisplay}</div>
                <div class="col-xl-2 col-md-4 text-center">Apareceu <strong>${totalOccurrences} vezes</strong></div>
                <div class="col-xl-3 col-md-5 mt-sm-2 mt-md-0 text-center">Pode indicar -> <strong>${formattedRate}</strong></div>
                <div class="col-xl-3 col-md-6 mt-sm-2 mt-md-0 d-flex gales">
                    <span>SG: <strong>${stats.green1}</strong></span> <span>G1: <strong>${stats.greenG1}</strong></span> <span>G2: <strong>${stats.greenG2}</strong></span> 
                </div>
                <div class="col-xl-1 col-md-2 mt-sm-2 mt-md-0 reds">Red: ${stats.red}</div>
            </div>`;
    });
    document.getElementById("pattern-result").innerHTML = html || "Nenhum padrão forte encontrado.";
}

function analyzeCards(historyData) {
    const cardStats = {};
    for (let i = 0; i < historyData.length - 3; i++) {
        const currentChar = historyData[i].charAt(0);
        const currentValue = historyData[i].match(/\((.*?)\)/)?.[1] || '?';
        const nextChar = historyData[i + 1]?.charAt(0);
        const nextCharG1 = historyData[i + 2]?.charAt(0);
        const nextCharG2 = historyData[i + 3]?.charAt(0);
        if (!currentValue || !nextChar || !nextCharG1 || !nextCharG2) continue;
        const cardKey = currentChar + '(' + currentValue + ')';
        if (!cardStats[cardKey]) {
            cardStats[cardKey] = { 'total': 0, 'green1V': 0, 'greenG1V': 0, 'greenG2V': 0, 'redV': 0, 'green1A': 0, 'greenG1A': 0, 'greenG2A': 0, 'redA': 0, 'appearedV': 0, 'appearedA': 0, 'appearedT': 0 };
        }
        cardStats[cardKey].total++;
        if (nextChar === 'V') cardStats[cardKey].appearedV++;
        if (nextChar === 'A') cardStats[cardKey].appearedA++;
        if (nextChar === 'T') cardStats[cardKey].appearedT++;
        const isGreenV = nextChar === 'V' || nextChar === 'T';
        const isGreenG1V = !isGreenV && (nextCharG1 === 'V' || nextCharG1 === 'T');
        const isGreenG2V = !isGreenV && !isGreenG1V && (nextCharG2 === 'V' || nextCharG2 === 'T');
        const isGreenA = nextChar === 'A' || nextChar === 'T';
        const isGreenG1A = !isGreenA && (nextCharG1 === 'A' || nextCharG1 === 'T');
        const isGreenG2A = !isGreenA && !isGreenG1A && (nextCharG2 === 'A' || nextCharG2 === 'T');
        if (isGreenV) { cardStats[cardKey].green1V++; } else if (isGreenG1V) { cardStats[cardKey].greenG1V++; } else if (isGreenG2V) { cardStats[cardKey].greenG2V++; } else { cardStats[cardKey].redV++; }
        if (isGreenA) { cardStats[cardKey].green1A++; } else if (isGreenG1A) { cardStats[cardKey].greenG1A++; } else if (isGreenG2A) { cardStats[cardKey].greenG2A++; } else { cardStats[cardKey].redA++; }
    }
    const sortedStats = Object.entries(cardStats).map(([key, data]) => {
        const totalVGreens = data.green1V + data.greenG1V + data.greenG2V;
        const totalAGreens = data.green1A + data.greenG1A + data.greenG2A;
        const rateV = totalVGreens / data.total * 100;
        const rateA = totalAGreens / data.total * 100;
        const bestRate = Math.max(rateV, rateA);
        return { 'key': key, 'data': data, 'bestRate': bestRate, 'total': data.total };
    });
    sortedStats.sort((a, b) => b.bestRate - a.bestRate || b.total - a.total);
    let html = '';
    const minAccuracy = parseInt(document.getElementById("percentualAcerto")?.value);
    const minOccurrences = parseInt(document.getElementById('minOcorrencias')?.value);
    sortedStats.forEach(item => {
        const { key, data, total } = item;
        const totalVGreens = data.green1V + data.greenG1V + data.greenG2V;
        const totalAGreens = data.green1A + data.greenG1A + data.greenG2A;
        let rateV = isNaN(totalVGreens / total * 100) ? 0 : totalVGreens / total * 100;
        let rateA = isNaN(totalAGreens / total * 100) ? 0 : totalAGreens / total * 100;
        if (total < minOccurrences || Math.max(rateV, rateA) < minAccuracy) return;
        const char = key.charAt(0);
        const value = key.match(/\((.*?)\)/)?.[1] || '?';
        const isVBetter = rateV > rateA || (rateV === rateA && data.appearedV >= data.appearedA);
        const suggestionRate = isVBetter ? rateV : rateA;
        const suggestionColor = isVBetter ? '🔴' : '🔵';
        const suggestionData = isVBetter ? data.green1V : data.green1A;
        const suggestionG1 = isVBetter ? data.greenG1V : data.greenG1A;
        const suggestionG2 = isVBetter ? data.greenG2V : data.greenG2A;
        const suggestionRed = isVBetter ? data.redV : data.redA;
        html += `
            <div class="row pt-3 pb-3 justify-content-center align-items-center" onclick="selectCardForAnalysis('${key}')">
                <div class="col-xl-3 col-md-4 d-flex align-items-center justify-content-lg-start justify-content-center">
                    ${formatCard(char, value)} <span style="margin-left: 10px;">Apareceu <strong style="margin-left: 5px;">${total} vezes</strong></span>
                </div>
                <div class="col-xl-4 col-md-5 text-center">
                    Pode indicar -> ${suggestionColor} <strong>(${suggestionRate.toFixed(2)}%)</strong>
                </div>
                <div class="col-xl-3 col-md-4 offset-md-1 mt-md-2 mt-lg-0 d-flex gales">
                    <span>SG: <strong>${suggestionData}</strong></span> <span>G1: <strong>${suggestionG1}</strong></span> <span>G2: <strong>${suggestionG2}</strong></span> 
                </div>
                <div class="col-xl-1 col-md-2 mt-md-2 mt-lg-0 reds">
                    Red: ${suggestionRed}
                </div>
            </div>`;
    });
    cardAnalysisGlobal = cardStats;
    document.getElementById('sinalCartas').innerHTML = html || "Nenhuma carta forte encontrada.";
}

function suggestEntry(historyData, cardStats) {
    if (historyData.length < 1) {
        return;
    }
    const lastCard = historyData[historyData.length - 1];
    const lastChar = lastCard.charAt(0);
    const lastValue = lastCard.match(/\((.*?)\)/)?.[1] || '?';
    const lastCardKey = lastChar + '(' + lastValue + ')';
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.value);
    const minAccuracy = parseInt(document.getElementById("percentualAcerto")?.value);
    const stats = cardStats[lastCardKey];

    if (!stats || stats.total < minOccurrences) {
        document.getElementById('martingale-resultCarta').innerHTML = "🎯 Sugestão Cartas: <strong>Buscando Padrão...</strong>";
        return;
    }

    const totalVGreens = stats.green1V + stats.greenG1V + stats.greenG2V;
    const totalAGreens = stats.green1A + stats.greenG1A + stats.greenG2A;
    let rateV = isNaN(totalVGreens / stats.total * 100) ? 0 : totalVGreens / stats.total * 100;
    let rateA = isNaN(totalAGreens / stats.total * 100) ? 0 : totalAGreens / stats.total * 100;

    let suggestionText = '';
    if (rateV >= minAccuracy || rateA >= minAccuracy) {
        const isVBetter = rateV > rateA || (rateV === rateA && stats.appearedV >= stats.appearedA);
        const suggestionRate = isVBetter ? rateV : rateA;
        const suggestionColor = isVBetter ? '🔴' : '🔵';
        suggestionText = `${suggestionColor} ${stats.total} (${suggestionRate.toFixed(2)}%)`;
        document.getElementById("martingale-resultCarta").innerHTML = `🎯 Sugestão Cartas após ${formatCard(lastChar, lastValue)} =><br><strong>${suggestionText}</strong>`;
    } else {
        document.getElementById("martingale-resultCarta").innerHTML = "🎯 Sugestão Cartas: <strong>Buscando Padrão...</strong>";
    }
}

function showIA(filteredPatterns) {
    const visualPatternsContainer = document.getElementById("padroes-visuais");
    if (!visualPatternsContainer) return;
    let html = '';
    if (filteredPatterns.length === 0) {
        html += "<div class=\"text-muted\">Nenhum padrão visual forte encontrado.</div>";
    } else {
        filteredPatterns.forEach(item => {
            const patternHtml = item.pattern.split(',').map(part => {
                const char = part.charAt(0);
                const value = part.match(/\((.*?)\)/)?.[1] ?? '';
                return `<span class="circle ${char === 'V' ? "banker" : char === 'A' ? "player" : 'tie'}">${value === '*' ? '' : value}</span>`;
            }).join(" ");
            const suggestedBetChar = item.suggestedColor === '🔴' ? 'V' : 'A';
            html += `
                <div class="row justify-content-center pt-3 pb-3" onclick="drawVisualPattern('${item.pattern}', [${item.indices.join(',')}], '${suggestedBetChar}')">
                    <div class="col-xl-3 col-md-4 d-flex flex-wrap gap-xl-1 justify-content-lg-start justify-content-center">${patternHtml}</div>
                    <div class="col-xl-2 col-md-4 text-center">Apareceu <strong>${item.occurrences} vezes</strong></div>
                    <div class="col-xl-3 col-md-5 mt-md-2 mt-lg-0 text-center">Pode indicar -> ${item.suggestedColor}<strong> (${item.rate}%)</strong></div>
                    <div class="col-xl-3 col-md-6 mt-md-2 mt-lg-0d-flex gales">
                        <span>SG: <strong>${item.sg}</strong></span> <span>G1: <strong>${item.g1}</strong></span> <span>G2: <strong>${item.g2}</strong></span>
                    </div>
                    <div class="col-xl-1 col-md-2 mt-md-2 mt-lg-0 reds">
                        Red: ${item.red}
                    </div>
                </div>`;
        });
    }
    visualPatternsContainer.innerHTML = html;
}

function detectVisualPatterns(historyData) {
    const patterns = {};
    const minAccuracy = parseInt(document.getElementById("percentualAcerto")?.value);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.value);
    function getBetResult(betChar, outcome1, outcome2, outcome3) {
        if (outcome1 === betChar || outcome1 === 'T') return 'sg';
        if (outcome2 === betChar || outcome2 === 'T') return 'g1';
        if (outcome3 === betChar || outcome3 === 'T') return 'g2';
        return 'red';
    }
    for (let i = 0; i < historyData.length - 3; i++) {
        for (let size = 2; size <= 5; size++) {
            if (i + size + 2 >= historyData.length) continue;
            const sequence = historyData.slice(i, i + size);
            const charSequence = sequence.map(item => item.charAt(0));
            const valueSequence = sequence.map(item => item.match(/\((.*?)\)/)?.[1] || '*');
            const patternA = charSequence.join(',');
            const patternB = sequence.map(item => `${item.charAt(0)}(${item.match(/\((.*?)\)/)?.[1] || '*'})`).join(',');
            const patternC = sequence.map((item, index) => `${item.charAt(0)}(${valueSequence[index] === 'J' ? 'J' : valueSequence[index] === 'Q' ? 'Q' : valueSequence[index] === 'K' ? 'K' : '*'})`).join(',');
            [patternA, patternB, patternC].forEach(key => {
                if (!patterns[key]) {
                    patterns[key] = { 'indices': [], 'ocorrencias': 0, 'sgB': 0, 'g1B': 0, 'g2B': 0, 'redB': 0, 'sgP': 0, 'g1P': 0, 'g2P': 0, 'redP': 0 };
                }
                patterns[key].ocorrencias++;
                patterns[key].indices.push(i);
                const nextOutcome = historyData[i + size]?.charAt(0);
                const nextOutcomeG1 = historyData[i + size + 1]?.charAt(0);
                const nextOutcomeG2 = historyData[i + size + 2]?.charAt(0);
                const bankerResult = getBetResult('V', nextOutcome, nextOutcomeG1, nextOutcomeG2);
                patterns[key][`${bankerResult}B`]++;
                const playerResult = getBetResult('A', nextOutcome, nextOutcomeG1, nextOutcomeG2);
                patterns[key][`${playerResult}P`]++;
            });
        }
    }
    const filteredPatterns = Object.entries(patterns).map(([pattern, data]) => {
        let suggestedColor = '⚪';
        let bestRate = 0;
        let sgCount = 0, g1Count = 0, g2Count = 0, redCount = 0;
        const totalBankerGreens = data.sgB + data.g1B + data.g2B;
        const totalPlayerGreens = data.sgP + data.g1P + data.g2P;
        if (totalBankerGreens > totalPlayerGreens) {
            suggestedColor = '🔴'; bestRate = totalBankerGreens / data.ocorrencias * 100;
            sgCount = data.sgB; g1Count = data.g1B; g2Count = data.g2B; redCount = data.redB;
        } else if (totalPlayerGreens > totalBankerGreens) {
            suggestedColor = '🔵'; bestRate = totalPlayerGreens / data.ocorrencias * 100;
            sgCount = data.sgP; g1Count = data.g1P; g2Count = data.g2P; redCount = data.redP;
        } else if (data.redB < data.redP) {
            suggestedColor = '🔴'; bestRate = totalBankerGreens / data.ocorrencias * 100;
            sgCount = data.sgB; g1Count = data.g1B; g2Count = data.g2B; redCount = data.redB;
        } else {
            suggestedColor = '🔵'; bestRate = totalPlayerGreens / data.ocorrencias * 100;
            sgCount = data.sgP; g1Count = data.g1P; g2Count = data.g2P; redCount = data.redP;
        }
        return {
            'pattern': pattern, 'indices': data.indices, 'occurrences': data.ocorrencias,
            sg: sgCount, g1: g1Count, g2: g2Count, red: redCount,
            suggestedColor: suggestedColor, rate: bestRate.toFixed(2)
        };
    }).filter(item => item.occurrences >= minOccurrences && parseFloat(item.rate) >= minAccuracy).sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate) || b.sg - a.sg);
    showIA(filteredPatterns);
    return filteredPatterns;
}

function suggestEntryIA(historyData, visualPatterns) {
    const readQuantity = parseInt(document.getElementById('quantidade')?.value);
    const minAccuracy = parseInt(document.getElementById('percentualAcerto')?.value);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.value);
    const recentHistory = historyData.slice(-readQuantity);
    for (let size = 5; size >= 1; size--) {
        const lastSequence = recentHistory.slice(-size).map(item => `${item.charAt(0)}(${item.match(/\((.*?)\)/)?.[1] || '*'})`);
        const matchingPattern = visualPatterns.find(pattern => {
            const patternParts = pattern.pattern.split(',');
            if (patternParts.length !== lastSequence.length) return false;
            for (let i = 0; i < patternParts.length; i++) {
                const patternChar = patternParts[i].charAt(0);
                const patternValue = patternParts[i].match(/\((.*?)\)/)?.[1] || '*';
                const sequenceChar = lastSequence[i].charAt(0);
                const sequenceValue = lastSequence[i].match(/\((.*?)\)/)?.[1] || '*';
                if (patternChar !== sequenceChar) return false;
                if (patternValue !== '*' && patternValue !== sequenceValue) return false;
            }
            return parseFloat(pattern.rate) >= minAccuracy && pattern.occurrences >= minOccurrences;
        });
        if (matchingPattern) {
            const { suggestedColor: color, rate, occurrences } = matchingPattern;
            document.getElementById("martingale-resultIA").innerHTML = `🎯 Sugestão IA: <strong>${color} ${occurrences} (${rate}%)</strong>`;
            return;
        }
    }
    document.getElementById("martingale-resultIA").innerHTML = "🎯 Sugestão IA: <strong>Buscando padrão...</strong>";
}

// --- Funções de Ajuda e Utilitários ---

function formatCard(char, value) {
    const colorClass = char === 'V' ? "banker" : char === 'A' ? "player" : 'tie';
    return `<span class="circle ${colorClass}">${value}</span>`;
}
