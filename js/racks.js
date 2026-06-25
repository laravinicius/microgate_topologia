const expansaoRacks = {};
let detalhesPatchOverlay = null;
let detalhesPatchAtual = null;

function toggleSecaoRacks() {
    const container = document.getElementById('listaRacks');
    const btn = document.getElementById('toggleRacks');
    const oculto = container.classList.toggle('oculto');
    btn.textContent = oculto ? '▶ Racks' : '▼ Racks';
}

function togglePatchPanels(rackId) {
    expansaoRacks[rackId] = !expansaoRacks[rackId];
    const container = document.getElementById('pp-' + rackId);
    const btn = document.getElementById('toggle-' + rackId);
    if (container) {
        container.classList.toggle('oculto', !expansaoRacks[rackId]);
    }
    if (btn) {
        btn.textContent = expansaoRacks[rackId] ? '▼' : '▶';
    }
}

async function criarRack(){

    const nome =
    await solicitarTexto("Novo rack", "Nome do rack");

    if(!nome) return;

    db.racks.push({

        id:Date.now(),
        nome,
        patchPanels:[]
    });

    saveData();
    await saveData();

    renderRacks();
}

async function criarPatchPanel(
    rackId
){

    const nome =
    await solicitarTexto("Novo patch panel", "Nome do patch panel");

    if(!nome) return;

    const rack =
    db.racks.find(
        r=>r.id===rackId
    );

    rack.patchPanels.push({

        id:Date.now(),
        nome,

        portas:24
    });

    saveData();
    await saveData();

    renderRacks();
}

function renderRacks(){

    const area =
    document.getElementById(
        "listaRacks"
    );

    area.innerHTML="";

    db.racks.forEach(rack=>{

        const expandido = expansaoRacks[rack.id] || false;

        area.innerHTML += `

        <div class="rack">

            <div class="cabecalhoRack" onclick="togglePatchPanels(${rack.id})">
                <span class="rackToggle" id="toggle-${rack.id}">${expandido ? '▼' : '▶'}</span>
                <h4>${rack.nome}</h4>

                <button class="botaoPerigo" onclick="event.stopPropagation(); apagarRack(${rack.id})">
                    Apagar
                </button>
            </div>

            <button onclick="criarPatchPanel(${rack.id})">
                + Patch Panel
            </button>

            <div class="patchPanelsContainer ${expandido ? '' : 'oculto'}" id="pp-${rack.id}">

            ${rack.patchPanels.map(pp=>`
                <div class="patch" onclick="abrirDetalhesPatchPanel(${rack.id}, ${pp.id})">
                    <div>
                        ${pp.nome}
                        (${pp.portas}
                        portas)
                    </div>
                    <button class="botaoPerigo" onclick="event.stopPropagation(); apagarPatchPanel(${rack.id}, ${pp.id})">
                        Apagar
                    </button>
                </div>
            `).join("")}

            </div>

        </div>
        `;
    });

    if(typeof renderPainelVinculo === "function"){
        renderPainelVinculo();
    }
}

async function apagarRack(rackId){

    const indice =
    db.racks.findIndex(
        r=>r.id===rackId
    );

    if(indice === -1) return;

    const rack =
    db.racks[indice];

    const confirmado =
    await solicitarConfirmacao(
        "Apagar rack",
        `Deseja apagar o rack ${rack.nome} e seus patch panels?`
    );

    if(!confirmado) return;

    db.racks.splice(indice, 1);
    limparVinculosRack(rackId);

    if(vinculoAtivo?.rackId === rackId){
        vinculoAtivo = null;
    }

    saveData();
    await saveData();
    renderRacks();
    renderMesas();
}

async function apagarPatchPanel(rackId, patchId){

    const rack =
    db.racks.find(
        r=>r.id===rackId
    );

    const indice =
    rack?.patchPanels.findIndex(
        pp=>pp.id===patchId
    );

    if(!rack || indice === undefined || indice === -1) return;

    const patchPanel =
    rack.patchPanels[indice];

    const confirmado =
    await solicitarConfirmacao(
        "Apagar patch panel",
        `Deseja apagar o patch panel ${patchPanel.nome}?`
    );

    if(!confirmado) return;

    rack.patchPanels.splice(indice, 1);
    limparVinculosPatchPanel(patchId);

    if(vinculoAtivo?.patchId === patchId){
        vinculoAtivo = null;
    }

    saveData();
    await saveData();
    renderRacks();
    renderMesas();
}

function limparVinculosRack(rackId){

    db.mesas.forEach(mesa=>{
        mesa.pontos.forEach(ponto=>{
            if(ponto.rackId === rackId){
                limparVinculoPonto(ponto);
            }
        });
    });
}

function limparVinculosPatchPanel(patchId){

    db.mesas.forEach(mesa=>{
        mesa.pontos.forEach(ponto=>{
            if(ponto.patchId === patchId){
                limparVinculoPonto(ponto);
            }
        });
    });
}

function limparVinculoPonto(ponto){
    ponto.rackId = null;
    ponto.patchId = null;
    ponto.porta = null;
}

function obterConexoesPatchPanel(rackId, patchId) {
    const rack = db.racks.find(r => r.id === rackId);
    if (!rack) return [];
    const patchPanel = rack.patchPanels.find(pp => pp.id === patchId);
    if (!patchPanel) return [];

    const conexoes = [];
    for (let porta = 1; porta <= patchPanel.portas; porta++) {
        let mesaNome = null;
        let pontoId = null;
        for (const mesa of db.mesas) {
            for (const ponto of mesa.pontos) {
                if (ponto.rackId === rackId && ponto.patchId === patchId && ponto.porta === porta) {
                    mesaNome = mesa.nome;
                    pontoId = ponto.id;
                    break;
                }
            }
            if (mesaNome) break;
        }
        conexoes.push({ porta, mesaNome, pontoId });
    }
    return conexoes;
}

function abrirDetalhesPatchPanel(rackId, patchId) {
    if (detalhesPatchOverlay) return;
    detalhesPatchAtual = { rackId, patchId };
    detalhesPatchOverlay = document.createElement("div");
    detalhesPatchOverlay.className = "detalhesPatchOverlay";
    detalhesPatchOverlay.onclick = (e) => {
        if (e.target === detalhesPatchOverlay) fecharDetalhesPatchPanel();
    };
    document.body.appendChild(detalhesPatchOverlay);
    renderDetalhesPatchPanel();
}

function fecharDetalhesPatchPanel() {
    if (detalhesPatchOverlay) {
        detalhesPatchOverlay.remove();
        detalhesPatchOverlay = null;
    }
    detalhesPatchAtual = null;
}

function renderDetalhesPatchPanel() {
    if (!detalhesPatchAtual || !detalhesPatchOverlay) return;
    const { rackId, patchId } = detalhesPatchAtual;
    const rack = db.racks.find(r => r.id === rackId);
    const patchPanel = rack?.patchPanels.find(pp => pp.id === patchId);
    if (!rack || !patchPanel) {
        fecharDetalhesPatchPanel();
        return;
    }

    const conexoes = obterConexoesPatchPanel(rackId, patchId);

    let html = '<div class="detalhesPatchPainel">';

    html += '<div class="detalhesPatchCabecalho">';
    html += `<div class="detalhesPatchBreadcrumb">${rack.nome} &rarr; ${patchPanel.nome}</div>`;
    html += `<div class="detalhesPatchTitulo">Portas de ${patchPanel.nome}</div>`;
    html += '</div>';

    html += '<div class="detalhesPatchConteudo">';
    html += '<table class="detalhesPatchTabela">';
    html += '<thead><tr><th>Porta</th><th>Conexão</th></tr></thead>';
    html += '<tbody>';
    for (const cx of conexoes) {
        const conectado = cx.mesaNome
            ? `${cx.mesaNome} - P${cx.pontoId}`
            : '<span class="detalhesPatchLivre">Livre</span>';
        html += `<tr><td>${cx.porta}</td><td>${conectado}</td></tr>`;
    }
    html += '</tbody></table>';
    html += '</div>';

    html += '<div class="detalhesPatchAcoes">';
    html += '<button class="detalhesPatchFechar" onclick="fecharDetalhesPatchPanel()">Fechar</button>';
    html += '</div>';

    html += '</div>';
    detalhesPatchOverlay.innerHTML = html;
}
