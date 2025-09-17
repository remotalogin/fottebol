let detectedPatterns = {};
let selectedPattern = '';
let selectedCard = '';
let history = [];
let history300 = [];
let history1000 = [];
let patternSize = 3;
let readQuantity = 1000;
let cardAnalysisGlobal = {};
let lastHistory = [];
let originalData = [];
let scrollDone = false;
let loading = false;

function updateHistory() {
    const latestHistory = history.slice(-10);
    const hasNewEntry = latestHistory.length !== lastHistory.length || latestHistory.some((entry, index) => entry !== lastHistory[index]);
    if (hasNewEntry) {
        drawHistory(history);
        lastHistory = [...latestHistory];
    }
}

async function loadData() {
    // The anti-scraping obfuscation from the original code has been removed for clarity.
    if (loading) {
        return;
    }
    loading = true;
    const timeout = setTimeout(() => {
        loading = false;
    }, 3000);

    try {
        readQuantity = parseInt(document.getElementById("quantidade").value);
        patternSize = parseInt(document.getElementById("tamanho-padrao").value);

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

        history = combinedData.slice(-readQuantity);
        history1000 = combinedData.slice(-1000);
        history300 = combinedData.slice(-300);
        originalData = history300.map(item => item.charAt(0));

        const {
            columns,
            offset
        } = extractLast20Columns(originalData);

        const bigRoad = document.getElementById('bigRoad');
        if (bigRoad) {
            drawBigRoad(bigRoad, columns, offset);
        }

        const stats = {
            'ultimas20': calculateStats(history1000.slice(-20)),
            'ultimas100': calculateStats(history1000.slice(-100)),
            'ultimas500': calculateStats(history1000.slice(-500)),
            'ultimas1000': calculateStats(history1000.slice(-1000))
        };
        createStatsBlock(stats);

        updateMaxStreaks(history);

        detectedPatterns = detectPatterns(history, patternSize);
        showPatterns(detectedPatterns);

        let [martingaleSuggestion, martingalePattern] = getMartingaleSuggestion(history);
        let martingaleOccurrences = detectedPatterns[martingalePattern]?.["ocorrencias"] || 0;
        let martingaleColor = martingaleSuggestion.includes('🔵') ? '🔵' : martingaleSuggestion.includes('🔴') ? '🔴' : martingaleSuggestion.includes('🟠') ? '🟠' : '';
        let martingalePercent = martingaleSuggestion.match(/\((.*?)\)/)?.[1] || '';
        let martingaleHtml = martingaleColor && martingalePercent ? `🎯 Sugestão Cores: <strong>${martingaleColor} ${martingaleOccurrences} (${martingalePercent})</strong>` : "🎯 Sugestão Cores: <strong>Buscando padrão...</strong>";
        document.getElementById('martingale-result').innerHTML = martingaleHtml;

        if (lastHistory.length === 0) {
            drawHistory(history);
            lastHistory = [...history.slice(-10)];
        }

        analyzeCards(history);
        const visualPatterns = detectVisualPatterns(history);
        suggestEntryIA(history, visualPatterns);

    } catch (error) {
        console.error("❌ Erro ao carregar os dados:", error);
    } finally {
        clearTimeout(timeout);
        loading = false;
    }
}

loadData();
setInterval(loadData, 5000);
setInterval(updateHistory, 1000);

function drawHistory(historyData, highlightedPattern = selectedPattern || selectedCard, highlightIndices = []) {
    const dataContainer = document.getElementById('dados');
    dataContainer.innerHTML = '';
    const isPattern = /^[VAT]+$/.test(highlightedPattern);
    const patternLength = isPattern ? highlightedPattern.length : 1;

    if (highlightIndices.length === 0 && highlightedPattern) {
        for (let i = 0; i <= historyData.length - patternLength - 3; i++) {
            if (isPattern) {
                const currentPattern = historyData.slice(i, i + patternLength).map(item => item.charAt(0)).join('');
                if (currentPattern === highlightedPattern) {
                    highlightIndices.push(i);
                }
            } else {
                const currentCard = historyData[i].charAt(0) + '(' + (historyData[i].match(/\((.*?)\)/)?.[1] || '?') + ')';
                if (currentCard === highlightedPattern) {
                    highlightIndices.push(i);
                }
            }
        }
    }

    const patternStats = isPattern ? getPatternStats(highlightedPattern) : null;
    let suggestedBet = '';
    if (isPattern) {
        suggestedBet = patternStats?.['melhorOpcao'] || 'V';
    } else {
        const cardStats = cardAnalysisGlobal[highlightedPattern];
        if (cardStats) {
            const vGreens = cardStats.green1V + cardStats.greenG1V + cardStats.greenG2V;
            const aGreens = cardStats.green1A + cardStats.greenG1A + cardStats.greenG2A;
            const vRate = vGreens / cardStats.total * 100;
            const aRate = aGreens / cardStats.total * 100;
            if (aRate > vRate) {
                suggestedBet = 'A';
            } else if (vRate > aRate) {
                suggestedBet = 'V';
            } else {
                suggestedBet = cardStats.appearedA > cardStats.appearedV ? 'A' : 'V';
            }
        } else {
            suggestedBet = 'V';
        }
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
            const nextBet = historyData[highlightIndex + patternLength]?.["charAt"](0);
            const nextBetG1 = historyData[highlightIndex + patternLength + 1]?.['charAt'](0);
            const nextBetG2 = historyData[highlightIndex + patternLength + 2]?.["charAt"](0);

            if (index >= highlightIndex && index < highlightIndex + patternLength) {
                circle.classList.add('padrao');
                isHighlighted = true;
            } else {
                if (index === highlightIndex + patternLength) {
                    circle.classList.add(nextBet === suggestedBet || nextBet === 'T' ? "green1" : "highlight2");
                    isHighlighted = true;
                } else {
                    if (index === highlightIndex + patternLength + 1) {
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
                }
            }
        });

        if (!isHighlighted && highlightedPattern) {
            circle.classList.add("apagado");
        }
        dataContainer.appendChild(circle);
    });
}

function selectCardForAnalysis(card) {
    selectedCard = card;
    selectedPattern = '';
    drawHistory(history, card);
}

function isPatternStrong(pattern, stats, minOccurrences, minRate) {
    return detectedPatterns[pattern] && detectedPatterns[pattern].ocorrencias >= minOccurrences && stats && stats.melhorTaxa >= minRate;
}

function showPatterns(patterns) {
    let html = '';
    let minAccuracy = parseInt(document.getElementById("percentualAcerto").value);
    let strongPatterns = [];

    Object.keys(patterns).forEach(pattern => {
        let stats = getPatternStats(pattern);
        let occurrences = patterns[pattern].ocorrencias;

        if (!stats) {
            return;
        }

        let minOccurrences = parseInt(document.getElementById("minOcorrencias")?.["value"]);
        if (occurrences < minOccurrences) {
            return;
        }

        if (stats.melhorTaxa < minAccuracy) {
            return;
        }

        strongPatterns.push({
            'pattern': pattern,
            'stats': stats,
            'totalOccurrences': occurrences,
            'bestRate': stats.melhorTaxa
        });
    });

    strongPatterns.sort((a, b) => {
        if (b.bestRate !== a.bestRate) {
            return b.bestRate - a.bestRate;
        }
        return b.totalOccurrences - a.totalOccurrences;
    });

    strongPatterns.forEach(patternData => {
        const {
            pattern,
            stats,
            totalOccurrences
        } = patternData;
        let bestOption = stats.melhorOpcao;
        let bestRate = stats.melhorTaxa;
        let suggestedColor = bestOption === 'V' ? '🔴' : bestOption === 'A' ? '🔵' : '🟠';
        let formattedRate = suggestedColor + " (" + bestRate.toFixed(2) + '%)';
        let patternDisplay = pattern.split('').map(char => {
            const colorClass = char === 'V' ? 'banker' : char === 'A' ? "player" : char === 'T' ? "tie" : '';
            return `<span class="circle ${colorClass}"></span>`;
        }).join(" ");

        html += `
            <div class="row pt-3 pb-3 justify-content-center" onclick="selectPattern('${pattern}')">
                <div class="col-xl-3 col-md-4 d-flex flex-wrap gap-xl-1 justify-content-lg-start justify-content-center ">
                    ${patternDisplay}
                </div>
                <div class="col-xl-2 col-md-4 text-center">
                    Apareceu <strong>${totalOccurrences} vezes</strong>
                </div>
                <div class="col-xl-3 col-md-5 mt-sm-2 mt-md-0 text-center">
                    Pode indicar -> <strong>${formattedRate}</strong>
                </div>
                <div class="col-xl-3 col-md-6 mt-sm-2 mt-md-0 d-flex gales">
                    <span>SG: <strong>${stats.green1}</strong></span> 
                    <span>G1: <strong>${stats.greenG1}</strong></span>
                    <span>G2: <strong>${stats.greenG2}</strong></span> 
                </div>
                <div class="col-xl-1 col-md-2 mt-sm-2 mt-md-0 reds">
                    Red: ${stats.red}
                </div>
            </div>`;
    });
    document.getElementById("pattern-result").innerHTML = html || "Nenhum padrão forte encontrado.";
}

function selectPattern(pattern) {
    selectedPattern = pattern;
    selectedCard = '';
    drawHistory(history, pattern);
}

function selectCard(card) {
    selectedCard = card;
    selectedPattern = '';
    drawHistory(history);
}

function getPatternStats(pattern) {
    readQuantity = parseInt(document.getElementById('quantidade').value);
    patternSize = parseInt(document.getElementById("tamanho-padrao").value);

    if (!detectedPatterns[pattern]) {
        console.error("❌ Padrão não encontrado nos dados.");
        return;
    }

    let totalOccurrences = 0;
    let green1 = 0;
    let greenG1 = 0;
    let greenG2 = 0;
    let red = 0;
    let bestOption = null;
    let bestRate = -1;

    const nextOutcomes = detectedPatterns[pattern].proximos;
    Object.keys(nextOutcomes).forEach(outcome => {
        let green1Count = 0;
        let greenG1Count = 0;
        let greenG2Count = 0;
        let totalCount = 0;

        for (let i = 0; i <= history.length - patternSize; i++) {
            const currentPattern = history.slice(i, i + patternSize).map(item => item.charAt(0)).join('');
            if (currentPattern !== pattern) {
                continue;
            }
            const nextChar = history[i + patternSize]?.["charAt"](0);
            const nextCharG1 = history[i + patternSize + 1]?.["charAt"](0);
            const nextCharG2 = history[i + patternSize + 2]?.["charAt"](0);
            if (!nextChar || !nextCharG1 || !nextCharG2) {
                continue;
            }
            totalCount++;
            if (nextChar === outcome || nextChar === 'T') {
                green1Count++;
            } else {
                if (nextCharG1 === outcome || nextCharG1 === 'T') {
                    greenG1Count++;
                } else {
                    if (nextCharG2 === outcome || nextCharG2 === 'T') {
                        greenG2Count++;
                    }
                }
            }
        }

        const totalGreens = green1Count + greenG1Count + greenG2Count;
        const successRate = totalCount > 0 ? totalGreens / totalCount * 100 : 0;
        if (successRate > bestRate) {
            bestRate = successRate;
            bestOption = outcome;
        } else {
            if (successRate === bestRate) {
                const currentOptionCount = (nextOutcomes[bestOption] || 0) + (nextOutcomes.T || 0);
                const newOptionCount = (nextOutcomes[outcome] || 0) + (nextOutcomes.T || 0);
                if (newOptionCount > currentOptionCount) {
                    bestOption = outcome;
                }
            }
        }
    });

    if (!bestOption) {
        return;
    }

    for (let i = 0; i <= history.length - patternSize; i++) {
        const currentPattern = history.slice(i, i + patternSize).map(item => item.charAt(0)).join('');
        if (currentPattern !== pattern) {
            continue;
        }
        const nextChar = history[i + patternSize]?.['charAt'](0);
        const nextCharG1 = history[i + patternSize + 1]?.["charAt"](0);
        const nextCharG2 = history[i + patternSize + 2]?.['charAt'](0);
        if (!nextChar || !nextCharG1 || !nextCharG2) {
            continue;
        }
        totalOccurrences++;
        if (nextChar === bestOption || nextChar === 'T') {
            green1++;
        } else {
            if (nextCharG1 === bestOption || nextCharG1 === 'T') {
                greenG1++;
            } else {
                if (nextCharG2 === bestOption || nextCharG2 === 'T') {
                    greenG2++;
                } else {
                    red++;
                }
            }
        }
    }

    const totalGreens = green1 + greenG1 + greenG2;
    const finalRate = totalOccurrences > 0 ? totalGreens / totalOccurrences * 100 : 0;
    return {
        'melhorOpcao': bestOption,
        'melhorTaxa': finalRate,
        'green1': green1,
        'greenG1': greenG1,
        'greenG2': greenG2,
        'red': red,
        'total': totalOccurrences
    };
}

function getMartingaleSuggestion(historyData) {
    const minPatternSize = parseInt(document.getElementById("tamanho-padrao").value);
    const minAccuracy = parseInt(document.getElementById("percentualAcerto").value);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.["value"]);
    
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
    let patterns = {};
    for (let i = 0; i < historyData.length - size; i++) {
        let patternKey = historyData.slice(i, i + size).map(item => item.charAt(0)).join('');
        let nextOutcome = historyData[i + size]?.['charAt'](0) || '?';

        if (!patterns[patternKey]) {
            patterns[patternKey] = {
                'ocorrencias': 0,
                'proximos': {}
            };
        }
        patterns[patternKey].ocorrencias++;
        patterns[patternKey].proximos[nextOutcome] = (patterns[patternKey].proximos[nextOutcome] || 0) + 1;
    }
    return patterns;
}

function updateMaxStreaks(historyData) {
    let maxV = 0;
    let maxA = 0;
    let maxT = 0;
    let maxWithoutT = 0;
    let currentV = 0;
    let currentA = 0;
    let currentT = 0;
    let currentWithoutT = 0;

    for (let entry of historyData) {
        let char = entry.charAt(0);
        if (char === 'V') {
            currentV++;
            maxV = Math.max(maxV, currentV);
            currentA = 0;
            currentT = 0;
            currentWithoutT++;
        } else if (char === 'A') {
            currentA++;
            maxA = Math.max(maxA, currentA);
            currentV = 0;
            currentT = 0;
            currentWithoutT++;
        } else if (char === 'T') {
            currentT++;
            maxT = Math.max(maxT, currentT);
            currentV = 0;
            currentA = 0;
            maxWithoutT = Math.max(maxWithoutT, currentWithoutT);
            currentWithoutT = 0;
        }
    }

    document.getElementById("result-v").innerHTML = `Máxima de 🔴 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxV}</strong>`;
    document.getElementById("result-a").innerHTML = `Máxima de 🔵 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxA}</strong>`;
    document.getElementById("result-t").innerHTML = `Máxima de 🟠 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxT}</strong>`;
    document.getElementById("result-no-t").innerHTML = `Máxima sem 🟠 <i class="fa-solid fa-arrow-right">-></i> <strong>${maxWithoutT}</strong>`;
}

function formatCard(char, value) {
    let colorClass = char === 'V' ? "banker" : char === 'A' ? "player" : char === 'T' ? "tie" : '';
    return `<span class="circle ${colorClass}">${value}</span>`;
}

function analyzeCards(historyData) {
    let cardStats = {};
    for (let i = 0; i < historyData.length - 3; i++) {
        let currentChar = historyData[i].charAt(0);
        let currentValue = historyData[i].match(/\((.*?)\)/)?.[1] || '?';
        let nextChar = historyData[i + 1]?.["charAt"](0);
        let nextCharG1 = historyData[i + 2]?.["charAt"](0);
        let nextCharG2 = historyData[i + 3]?.["charAt"](0);

        if (!currentValue || !nextChar || !nextCharG1 || !nextCharG2) {
            continue;
        }

        let cardKey = currentChar + '(' + currentValue + ')';
        if (!cardStats[cardKey]) {
            cardStats[cardKey] = {
                'total': 0,
                'green1V': 0,
                'greenG1V': 0,
                'greenG2V': 0,
                'redV': 0,
                'green1A': 0,
                'greenG1A': 0,
                'greenG2A': 0,
                'redA': 0,
                'appearedV': 0,
                'appearedA': 0,
                'appearedT': 0
            };
        }

        cardStats[cardKey].total++;
        if (nextChar === 'V') cardStats[cardKey].appearedV++;
        if (nextChar === 'A') cardStats[cardKey].appearedA++;
        if (nextChar === 'T') cardStats[cardKey].appearedT++;

        let isGreenV = nextChar === 'V' || nextChar === 'T';
        let isGreenG1V = !isGreenV && (nextCharG1 === 'V' || nextCharG1 === 'T');
        let isGreenG2V = !isGreenV && !isGreenG1V && (nextCharG2 === 'V' || nextCharG2 === 'T');
        
        let isGreenA = nextChar === 'A' || nextChar === 'T';
        let isGreenG1A = !isGreenA && (nextCharG1 === 'A' || nextCharG1 === 'T');
        let isGreenG2A = !isGreenA && !isGreenG1A && (nextCharG2 === 'A' || nextCharG2 === 'T');

        if (isGreenV) {
            cardStats[cardKey].green1V++;
        } else if (isGreenG1V) {
            cardStats[cardKey].greenG1V++;
        } else if (isGreenG2V) {
            cardStats[cardKey].greenG2V++;
        } else {
            cardStats[cardKey].redV++;
        }

        if (isGreenA) {
            cardStats[cardKey].green1A++;
        } else if (isGreenG1A) {
            cardStats[cardKey].greenG1A++;
        } else if (isGreenG2A) {
            cardStats[cardKey].greenG2A++;
        } else {
            cardStats[cardKey].redA++;
        }
    }

    let sortedStats = Object.entries(cardStats).map(([key, data]) => {
        let totalVGreens = data.green1V + data.greenG1V + data.greenG2V;
        let totalAGreens = data.green1A + data.greenG1A + data.greenG2A;
        let rateV = totalVGreens / data.total * 100;
        let rateA = totalAGreens / data.total * 100;
        let bestRate = Math.max(rateV, rateA);
        return {
            'key': key,
            'data': data,
            'bestRate': bestRate,
            'total': data.total
        };
    });

    sortedStats.sort((a, b) => {
        if (b.bestRate !== a.bestRate) {
            return b.bestRate - a.bestRate;
        }
        return b.total - a.total;
    });

    let html = '';
    let minAccuracy = parseInt(document.getElementById("percentualAcerto")?.["value"]);
    let minOccurrences = parseInt(document.getElementById('minOcorrencias')?.["value"]);

    sortedStats.forEach(item => {
        const key = item.key;
        const data = item.data;
        const total = data.total;

        let totalVGreens = data.green1V + data.greenG1V + data.greenG2V;
        let totalAGreens = data.green1A + data.greenG1A + data.greenG2A;
        let rateV = totalVGreens / total * 100;
        let rateA = totalAGreens / total * 100;

        if (total < minOccurrences || Math.max(rateV, rateA) < minAccuracy) {
            return;
        }

        let char = key.charAt(0);
        let value = key.match(/\((.*?)\)/)?.[1] || '?';

        rateV = isNaN(rateV) ? 0 : rateV;
        rateA = isNaN(rateA) ? 0 : rateA;

        let suggestion;
        if (rateV > rateA) {
            suggestion = "🔴 V (" + rateV.toFixed(2) + '%)';
        } else if (rateA > rateV) {
            suggestion = "🔵 A (" + rateA.toFixed(2) + '%)';
        } else {
            if (data.appearedV > data.appearedA) {
                suggestion = "🔴 V (" + rateV.toFixed(2) + '%)';
            } else if (data.appearedA > data.appearedV) {
                suggestion = "🔵 A (" + rateA.toFixed(2) + '%)';
            } else {
                suggestion = "🔴 V (" + rateV.toFixed(2) + '%)';
            }
        }

        html += `
            <div class="row pt-3 pb-3 justify-content-center align-items-center" onclick="selectCardForAnalysis('${key}')">
                <div class="col-xl-3 col-md-4 d-flex align-items-center justify-content-lg-start justify-content-center">
                    ${formatCard(char, value)} <span style="margin-left: 10px;">Apareceu <strong style="margin-left: 5px;">${total} vezes</strong></span>
                </div>
                ${suggestion.includes('V') ? `
                    <div class="col-xl-4 col-md-4 text-center">
                        Pode indicar -> 🔴 <strong>(${rateV.toFixed(2)}%)</strong>
                    </div>
                    <div class="col-xl-3 col-md-5 offset-md-1 mt-md-2 mt-lg-0 d-flex gales">
                        <span>SG: <strong>${data.green1V}</strong></span> 
                        <span>G1: <strong>${data.greenG1V}</strong></span>
                        <span>G2: <strong>${data.greenG2V}</strong></span> 
                    </div>
                    <div class="col-xl-1 col-md-2 mt-md-2 mt-lg-0 reds">
                        Red: ${data.redV}
                    </div>
                ` : `
                    <div class="col-xl-4 col-md-5 text-center">
                        Pode indicar -> 🔵 <strong>(${rateA.toFixed(2)}%)</strong>
                    </div>
                    <div class="col-xl-3 col-md-4 offset-md-1 mt-md-2 mt-lg-0 d-flex gales">
                        <span>SG: <strong>${data.green1A}</strong></span> 
                        <span>G1: <strong>${data.greenG1A}</strong></span>
                        <span>G2: <strong>${data.greenG2A}</strong></span> 
                    </div>
                    <div class="col-xl-1 col-md-2 mt-md-2 mt-lg-0 reds">
                        Red: ${data.redA}
                    </div>
                `}
            </div>
        `;
    });

    cardAnalysisGlobal = cardStats;
    document.getElementById('sinalCartas').innerHTML = html;
    suggestEntry(historyData, cardStats);
}

function suggestEntry(historyData, cardStats) {
    if (historyData.length < 1) {
        return;
    }
    const lastChar = historyData[historyData.length - 1].charAt(0);
    const lastValue = historyData[historyData.length - 1].match(/\((.*?)\)/)?.[1] || '?';
    const lastCardKey = lastChar + '(' + lastValue + ')';
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.["value"]);
    const minAccuracy = parseInt(document.getElementById("percentualAcerto")?.["value"]);
    const stats = cardStats[lastCardKey];

    if (!stats || stats.total < minOccurrences) {
        document.getElementById('martingale-resultCarta').innerHTML = "🎯 Sugestão Cartas: <strong>Buscando Padrão...</strong>";
        return;
    }

    const totalVGreens = stats.green1V + stats.greenG1V + stats.greenG2V;
    const totalAGreens = stats.green1A + stats.greenG1A + stats.greenG2A;
    let rateV = totalVGreens / stats.total * 100;
    let rateA = totalAGreens / stats.total * 100;

    rateV = isNaN(rateV) ? 0 : rateV;
    rateA = isNaN(rateA) ? 0 : rateA;

    let suggestionText = '';
    if (rateV >= minAccuracy || rateA >= minAccuracy) {
        if (rateV > rateA) {
            suggestionText = `🔴 ${stats.total} (${rateV.toFixed(2)}%)`;
        } else if (rateA > rateV) {
            suggestionText = `🔵 ${stats.total} (${rateA.toFixed(2)}%)`;
        } else {
            if (stats.appearedV > stats.appearedA) {
                suggestionText = `🔴 ${stats.total} (${rateV.toFixed(2)}%)`;
            } else if (stats.appearedA > stats.appearedV) {
                suggestionText = `🔵 ${stats.total} (${rateA.toFixed(2)}%)`;
            } else {
                suggestionText = `🔴 ${stats.total} (${rateV.toFixed(2)}%)`;
            }
        }

        document.getElementById("martingale-resultCarta").innerHTML = `
            🎯 Sugestão Cartas após ${formatCard(lastChar, lastValue)} =><br>
            <strong>${suggestionText}</strong>
        `;
    } else {
        document.getElementById("martingale-resultCarta").innerHTML = "🎯 Sugestão Cartas: <strong>Buscando Padrão...</strong>";
    }
}

function clearHighlights() {
    selectedPattern = '';
    selectedCard = '';
    const dataContainer = document.getElementById("dados");
    if (!dataContainer) {
        return;
    }
    const circles = dataContainer.querySelectorAll(".circle");
    circles.forEach(circle => {
        circle.classList.remove("highlight", "green1", "greenG1", 'greenG2', "apagado", "padrao", "highlight2");
    });
}

document.addEventListener("DOMContentLoaded", function() {
    const suggestionBlock = document.querySelector(".header .sugestao");
    const blockTop = suggestionBlock.getBoundingClientRect().top + window.scrollY;
    window.addEventListener("scroll", function() {
        if (window.scrollY >= blockTop) {
            suggestionBlock.classList.add("fixed");
        } else {
            suggestionBlock.classList.remove("fixed");
        }
    });
});

document.querySelector(".botaoAtt").addEventListener("click", clearHighlights);

function detectVisualPatterns(historyData) {
    const patterns = {};
    const minAccuracy = parseInt(document.getElementById("percentualAcerto")?.["value"]);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.['value']);

    function getBetResult(betChar, outcome1, outcome2, outcome3) {
        if (outcome1 === betChar || outcome1 === 'T') return 'sg';
        if (outcome2 === betChar || outcome2 === 'T') return 'g1';
        if (outcome3 === betChar || outcome3 === 'T') return 'g2';
        return 'red';
    }

    for (let i = 0; i < historyData.length - 3; i++) {
        for (let size = 2; size <= 5; size++) {
            if (i + size + 2 >= historyData.length) {
                continue;
            }

            const sequence = historyData.slice(i, i + size);
            const charSequence = sequence.map(item => item.charAt(0));
            const valueSequence = sequence.map(item => item.match(/\((.*?)\)/)?.[1] || '*');

            const patternA = charSequence.join(','); // Example: V,A,V
            const patternB = sequence.map(item => {
                const char = item.charAt(0);
                const value = item.match(/\((.*?)\)/)?.[1] || '*';
                return `${char}(${value})`;
            }).join(','); // Example: V(J),A(K),V(5)

            const patternC = sequence.map((item, index) => {
                const char = item.charAt(0);
                const value = valueSequence[index];
                return index % 2 === 0 ? `${char}(*)` : `${char}(${value})`;
            }).join(','); // Example: V(*),A(K),V(*)

            [patternA, patternB, patternC].forEach(key => {
                if (!patterns[key]) {
                    patterns[key] = {
                        'indices': [],
                        'ocorrencias': 0,
                        'sgB': 0, 'g1B': 0, 'g2B': 0, 'redB': 0,
                        'sgP': 0, 'g1P': 0, 'g2P': 0, 'redP': 0
                    };
                }
                patterns[key].ocorrencias++;
                patterns[key].indices.push(i);

                const nextOutcome = historyData[i + size]?.["charAt"](0);
                const nextOutcomeG1 = historyData[i + size + 1]?.['charAt'](0);
                const nextOutcomeG2 = historyData[i + size + 2]?.["charAt"](0);

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
        let bestGale = '';
        let sgCount = 0, g1Count = 0, g2Count = 0, redCount = 0;

        const totalBankerGreens = data.sgB + data.g1B + data.g2B;
        const totalPlayerGreens = data.sgP + data.g1P + data.g2P;

        if (totalBankerGreens > totalPlayerGreens) {
            suggestedColor = '🔴';
            bestRate = totalBankerGreens / data.ocorrencias * 100;
            sgCount = data.sgB;
            g1Count = data.g1B;
            g2Count = data.g2B;
            redCount = data.redB;
        } else if (totalPlayerGreens > totalBankerGreens) {
            suggestedColor = '🔵';
            bestRate = totalPlayerGreens / data.ocorrencias * 100;
            sgCount = data.sgP;
            g1Count = data.g1P;
            g2Count = data.g2P;
            redCount = data.redP;
        } else if (data.redB < data.redP) { // Tie-breaker for same green count, choose the one with fewer reds
            suggestedColor = '🔴';
            bestRate = totalBankerGreens / data.ocorrencias * 100;
            sgCount = data.sgB;
            g1Count = data.g1B;
            g2Count = data.g2B;
            redCount = data.redB;
        } else {
            suggestedColor = '🔵';
            bestRate = totalPlayerGreens / data.ocorrencias * 100;
            sgCount = data.sgP;
            g1Count = data.g1P;
            g2Count = data.g2P;
            redCount = data.redP;
        }
        
        if (sgCount >= g1Count && sgCount >= g2Count) {
            bestGale = 'SG';
        } else if (g1Count >= g2Count) {
            bestGale = 'G1';
        } else {
            bestGale = 'G2';
        }

        return {
            'pattern': pattern,
            'indices': data.indices,
            'occurrences': data.ocorrencias,
            'sg': sgCount,
            'g1': g1Count,
            'g2': g2Count,
            'red': redCount,
            'suggestedColor': suggestedColor,
            'bestGale': bestGale,
            'rate': bestRate.toFixed(2)
        };
    }).filter(item => item.occurrences >= minOccurrences && parseFloat(item.rate) >= minAccuracy).sort((a, b) => b.rate - a.rate || b.sg - a.sg);

    const visualPatternsContainer = document.getElementById("padroes-visuais");
    if (visualPatternsContainer) {
        let html = '';
        if (filteredPatterns.length === 0) {
            html += "<div class=\"text-muted\">Nenhum padrão visual forte encontrado.</div>";
        } else {
            filteredPatterns.forEach(item => {
                const patternHtml = item.pattern.split(',').map(part => {
                    const char = part.charAt(0);
                    const value = part.match(/\((.*?)\)/)?.[1] ?? '';
                    const colorClass = char === 'V' ? "banker" : char === 'A' ? "player" : char === 'T' ? "tie" : '';
                    return `<span class="circle ${colorClass}">${value === '*' ? '' : value}</span>`;
                }).join(" ");
                const suggestedBetChar = item.suggestedColor === '🔴' ? 'V' : item.suggestedColor === '🔵' ? 'A' : '';
                html += `
                    <div class="row justify-content-center pt-3 pb-3" onclick="drawHistoryWithVisualPattern('${item.pattern}', [${item.indices.join(',')}], '${suggestedBetChar}')">
                        <div class="col-xl-3 col-md-4 d-flex flex-wrap gap-xl-1 justify-content-lg-start justify-content-center">${patternHtml}</div>
                        <div class="col-xl-2 col-md-4 text-center">Apareceu <strong>${item.occurrences} vezes</strong></div>
                        <div class="col-xl-3 col-md-5 mt-md-2 mt-lg-0 text-center">Pode indicar -> ${item.suggestedColor}<strong> (${item.rate}%)</strong></div>
                        <div class="col-xl-3 col-md-6 mt-md-2 mt-lg-0d-flex gales">
                            <span>SG: <strong>${item.sg}</strong></span>
                            <span>G1: <strong>${item.g1}</strong></span>
                            <span>G2: <strong>${item.g2}</strong></span>
                        </div>
                        <div class="col-xl-1 col-md-2 mt-md-2 mt-lg-0 reds">
                            Red: ${item.red}
                        </div>
                    </div>`;
            });
        }
        visualPatternsContainer.innerHTML = html;
    }
    return filteredPatterns;
}

function drawHistoryWithVisualPattern(pattern, highlightIndices, suggestedBet = 'V') {
    const dataContainer = document.getElementById("dados");
    dataContainer.innerHTML = '';
    const patternLength = pattern.split(',').length;

    history.forEach((item, index) => {
        const char = item.charAt(0);
        const value = item.match(/\((.*?)\)/)?.[1] || '';
        let colorClass = char === 'V' ? "banker" : char === 'A' ? "player" : char === 'T' ? 'tie' : '';
        const circle = document.createElement("div");
        circle.classList.add("circle", colorClass);
        circle.textContent = value;
        let isHighlighted = false;

        highlightIndices.forEach(highlightIndex => {
            const nextOutcome = history[highlightIndex + patternLength]?.["charAt"](0);
            const nextOutcomeG1 = history[highlightIndex + patternLength + 1]?.["charAt"](0);
            const nextOutcomeG2 = history[highlightIndex + patternLength + 2]?.["charAt"](0);

            if (index >= highlightIndex && index < highlightIndex + patternLength) {
                circle.classList.add("padrao");
                isHighlighted = true;
            } else {
                if (index === highlightIndex + patternLength) {
                    if (nextOutcome === suggestedBet || nextOutcome === 'T') {
                        circle.classList.add("green1");
                    } else {
                        circle.classList.add("highlight2");
                    }
                    isHighlighted = true;
                } else if (index === highlightIndex + patternLength + 1) {
                    if (nextOutcome === suggestedBet || nextOutcome === 'T') {
                        circle.classList.add("apagado");
                    } else if (nextOutcomeG1 === suggestedBet || nextOutcomeG1 === 'T') {
                        circle.classList.add("green1");
                    } else {
                        circle.classList.add('highlight2');
                    }
                    isHighlighted = true;
                } else if (index === highlightIndex + patternLength + 2) {
                    if (nextOutcome === suggestedBet || nextOutcome === 'T' || nextOutcomeG1 === suggestedBet || nextOutcomeG1 === 'T') {
                        circle.classList.add("apagado");
                    } else if (nextOutcomeG2 === suggestedBet || nextOutcomeG2 === 'T') {
                        circle.classList.add("green1");
                    } else {
                        circle.classList.add("highlight2");
                    }
                    isHighlighted = true;
                }
            }
        });

        if (!isHighlighted) {
            circle.classList.add("apagado");
        }
        dataContainer.appendChild(circle);
    });
}

function suggestEntryIA(historyData, visualPatterns) {
    const readQuantity = parseInt(document.getElementById('quantidade')?.['value']);
    const minAccuracy = parseInt(document.getElementById('percentualAcerto')?.["value"]);
    const minOccurrences = parseInt(document.getElementById("minOcorrencias")?.['value']);
    const recentHistory = historyData.slice(-readQuantity);

    for (let size = 5; size >= 1; size--) {
        const lastSequence = recentHistory.slice(-size).map(item => {
            const char = item.charAt(0);
            const value = item.match(/\((.*?)\)/)?.[1] || '*';
            return `${char}(${value})`;
        });
        
        const matchingPattern = visualPatterns.find(pattern => {
            const patternParts = pattern.pattern.split(',');
            if (patternParts.length !== lastSequence.length) {
                return false;
            }

            for (let i = 0; i < patternParts.length; i++) {
                const patternChar = patternParts[i].charAt(0);
                const patternValue = patternParts[i].match(/\((.*?)\)/)?.[1];
                const sequenceChar = lastSequence[i].charAt(0);
                const sequenceValue = lastSequence[i].match(/\((.*?)\)/)?.[1];

                if (patternChar !== sequenceChar) {
                    return false;
                }
                if (patternValue !== '*' && patternValue !== sequenceValue) {
                    return false;
                }
            }

            return parseFloat(pattern.rate) >= minAccuracy && pattern.occurrences >= minOccurrences;
        });

        if (matchingPattern) {
            const color = matchingPattern.suggestedColor;
            const rate = matchingPattern.rate;
            const occurrences = matchingPattern.occurrences;
            document.getElementById("martingale-resultIA").innerHTML = `🎯 Sugestão IA: <strong>${color} ${occurrences} (${rate}%)</strong>`;
            return;
        }
    }
    document.getElementById("martingale-resultIA").innerHTML = "🎯 Sugestão IA: <strong>Buscando padrão...</strong>";
}

function extractLast20Columns(data, rowLimit = 50, columnLimit = 100) {
    let columns = [];
    let currentColumn = -1;
    let currentRow = 0;
    let lastChar = '';
    let flatList = [];
    let tieCount = 0;

    for (let i = 0; i < data.length; i++) {
        const char = data[i];

        if (char === 'T') {
            tieCount++;
            continue;
        }
        
        if (tieCount > 0 && flatList.length > 0) {
            const lastEntry = flatList[flatList.length - 1];
            lastEntry.empate = true;
            lastEntry.empateCount = tieCount;
            tieCount = 0;
        }

        if (char === lastChar) {
            let nextRow = currentRow + 1;
            if (!columns[currentColumn]) {
                columns[currentColumn] = [];
            }
            while (nextRow < rowLimit && columns[currentColumn][nextRow]) {
                nextRow++;
            }
            if (nextRow < rowLimit) {
                currentRow = nextRow;
            } else {
                currentColumn++;
                currentRow = 0;
            }
        } else {
            currentColumn++;
            currentRow = 0;
        }

        lastChar = char;
        if (!columns[currentColumn]) {
            columns[currentColumn] = [];
        }
        columns[currentColumn][currentRow] = char;
        flatList.push({
            'col': currentColumn,
            'row': currentRow,
            'val': char,
            'empate': false,
            'empateCount': 0
        });
    }

    if (tieCount > 0 && flatList.length > 0) {
        const lastEntry = flatList[flatList.length - 1];
        lastEntry.empate = true;
        lastEntry.empateCount = tieCount;
    }

    const allCols = flatList.map(item => item.col);
    const maxCol = Math.max(...allCols);
    const startCol = maxCol - columnLimit + 1;

    return {
        'colunas': flatList.filter(item => item.col >= startCol),
        'deslocamento': startCol
    };
}

function drawBigRoad(container, columns, offset) {
    container.innerHTML = '';
    const maxRow = Math.max(...columns.map(item => item.row)) + 1;
    const maxCol = Math.max(...columns.map(item => item.col)) - offset + 1;

    for (let row = 0; row < maxRow; row++) {
        for (let col = 0; col < maxCol; col++) {
            const cell = document.createElement('div');
            cell.classList.add("grid-bg-cell");
            cell.style.gridColumnStart = col + 1;
            cell.style.gridRowStart = row + 1;
            container.appendChild(cell);
        }
    }

    for (const item of columns) {
        const cell = document.createElement("div");
        cell.classList.add("cell", item.val);
        if (item.empate) {
            cell.classList.add("empate");
            if (item.empateCount > 1) {
                const number = document.createElement('span');
                number.classList.add("empate-numero");
                number.textContent = item.empateCount;
                cell.appendChild(number);
            }
        }
        cell.style.gridColumnStart = item.col - offset + 1;
        cell.style.gridRowStart = item.row + 1;
        container.appendChild(cell);
    }
    
    if (!scrollDone) {
        setTimeout(() => {
            container.parentElement.scrollLeft = container.scrollWidth;
            scrollDone = true;
        }, 0);
    }
}

function generateAllStats(historyData) {
    return {
        'ultimas20': calculateStats(historyData.slice(-20)),
        'ultimas100': calculateStats(historyData.slice(-100)),
        'ultimas500': calculateStats(historyData.slice(-500)),
        'ultimas1000': calculateStats(historyData.slice(-1000))
    };
}

function calculateStats(historyData) {
    const totalEntries = historyData.length;
    let redCount = 0;
    let blueCount = 0;
    let tieCount = 0;

    historyData.forEach(item => {
        const char = item.trim().charAt(0);
        if (char === 'V') {
            redCount++;
        } else if (char === 'A') {
            blueCount++;
        } else if (char === 'T') {
            tieCount++;
        }
    });

    if (totalEntries === 0) {
        return {
            'vermelho': "0.0",
            'azul': "0.0",
            'empate': '0.0'
        };
    }

    return {
        'vermelho': (redCount / totalEntries * 100).toFixed(1),
        'azul': (blueCount / totalEntries * 100).toFixed(1),
        'empate': (tieCount / totalEntries * 100).toFixed(1)
    };
}

function createStatsBlock(stats) {
    const container = document.getElementById("bloco-estatisticas");
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const titles = {
        'ultimas20': "últimas 20 rodadas",
        'ultimas100': "últimas 100 rodadas",
        'ultimas500': "últimas 500 rodadas",
        'ultimas1000': "últimas 1000 rodadas"
    };

    for (let key in stats) {
        const statData = stats[key];
        const statBox = document.createElement("div");
        statBox.className = "col-xl-3 col-md-6 result-box bg text-center";
        statBox.innerHTML = `
            <h6 class="text-center"><strong>% das ${titles[key]}</strong></h6>
            🔴 Vermelho -> ${statData.vermelho}%<br>
            🔵 Azul -> ${statData.azul}%<br>
            🟠 Empate -> ${statData.empate}%<br>
        `;
        container.appendChild(statBox);
    }
}
