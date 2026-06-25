let vinculoAtivo = null;

const MESA_LARGURA = 240;
const MESA_ALTURA = 480;
const COLS = 2;
const GAP_X = 20;
const GAP_Y = 20;
const OFFSET_X = 20;
const OFFSET_Y = 20;

function calcularPosicaoGrelha(indice) {
    const col = indice % COLS;
    const row = Math.floor(indice / COLS);
    return {
        x: OFFSET_X + col * (MESA_LARGURA + GAP_X),
        y: OFFSET_Y + row * (MESA_ALTURA + GAP_Y)
    };
}

function reorganizarGrelha() {
    db.mesas.forEach((mesa, i) => {
        const pos = calcularPosicaoGrelha(i);
        mesa.x = pos.x;
        mesa.y = pos.y;
    });
}

async function criarMesa(){

    const nome =
    await solicitarTexto("Nova mesa", "Nome da mesa");

    if(!nome) return;

    const mesa = {

        id: Date.now(),

        nome,

        x: 0,
        y: 0,

        fixada: true,

        pontos:Array.from(
            {length:8},
            (_,i)=>({

                id:i+1,

                rackId:null,
                patchId:null,
                porta:null

            })
        )
    };

    db.mesas.push(mesa);
    reorganizarGrelha();
    saveData();
    renderMesas();
}

function renderMesas(){

    const mapa =
    document.getElementById("mapa");

    mapa.innerHTML = "";

    db.mesas.forEach(mesa=>{

        const div =
        document.createElement("div");

        div.className = "mesa";

        div.setAttribute("data-mesa-id", mesa.id);

        div.style.left =
        mesa.x+"px";

        div.style.top =
        mesa.y+"px";

        div.innerHTML = `

        <div class="tituloMesa">

            <strong>${mesa.nome}</strong>

            <div class="acoesMesa">
                <button class="botaoPerigo" onclick="
                apagarMesa(${mesa.id})
                ">
                    Apagar
                </button>
            </div>

        </div>

        <div class="grade">

            ${mesa.pontos.map(p=>`
            <div
                class="ponto ${p.rackId ? 'ocupado' : ''}"
                onclick="iniciarVinculoPonto(${mesa.id}, ${p.id})"
                title="${resumirLigacaoPonto(p)}"
            >
                <span>P${p.id}</span>
                ${resumirLigacaoPonto(p) ? `<small>${resumirLigacaoPonto(p)}</small>` : ''}
            </div>
            `).join("")}

        </div>
        `;

        mapa.appendChild(div);
    });

    renderPainelVinculo();
}

function formatNomeRack(nome){
    return nome.trim().replace(/^(.+?)(Rack)(\d+)$/i, (_, a, b, c) => a + ' | ' + b + ' ' + c);
}

function resumirLigacaoPonto(ponto){

    if(!ponto.rackId || !ponto.patchId || !ponto.porta){
        return "";
    }

    const rack =
    db.racks.find(
        r=>r.id===ponto.rackId
    );

    const patchPanel =
    rack?.patchPanels.find(
        pp=>pp.id===ponto.patchId
    );

    if(!rack || !patchPanel){
        return "Vínculo inválido";
    }

    return `${formatNomeRack(rack.nome)} | ${patchPanel.nome} | Porta ${ponto.porta}`;
}

let vinculoOverlay = null;

function getMesaPonto(mesaId, pontoId){
    const mesa =
    db.mesas.find(
        m=>m.id===mesaId
    );
    if(!mesa) return null;
    return mesa.pontos.find(p=>p.id===pontoId);
}

function getRackNome(rackId){
    const rack =
    db.racks.find(
        r=>r.id===rackId
    );
    return rack ? rack.nome : "";
}

function getPatchNome(rackId, patchId){
    const rack =
    db.racks.find(
        r=>r.id===rackId
    );
    if(!rack) return "";
    const pp =
    rack.patchPanels.find(
        p=>p.id===patchId
    );
    return pp ? pp.nome : "";
}

function construirBreadcrumb(){
    if(!vinculoAtivo) return "";
    const mesa =
    db.mesas.find(
        m=>m.id===vinculoAtivo.mesaId
    );
    const parts = [];
    if(mesa) parts.push(mesa.nome);
    parts.push("P" + vinculoAtivo.pontoId);
    if(vinculoAtivo.rackId) parts.push(getRackNome(vinculoAtivo.rackId));
    if(vinculoAtivo.patchId) parts.push(getPatchNome(vinculoAtivo.rackId, vinculoAtivo.patchId));
    return parts.join(" → ");
}

function abrirPainelVinculo(){
    if(vinculoOverlay) return;
    vinculoOverlay = document.createElement("div");
    vinculoOverlay.className = "vinculoOverlay";
    vinculoOverlay.onclick = (e)=>{
        if(e.target === vinculoOverlay) fecharPainelVinculo();
    };
    document.body.appendChild(vinculoOverlay);
    renderPainelVinculo();
}

function fecharPainelVinculo(){
    if(vinculoOverlay){
        vinculoOverlay.remove();
        vinculoOverlay = null;
    }
}

function iniciarVinculoPonto(
    mesaId,
    pontoId
){

    const mesa =
    db.mesas.find(
        m=>m.id===mesaId
    );

    const ponto =
    mesa?.pontos.find(
        p=>p.id===pontoId
    );

    if(!mesa || !ponto) return;

    // Se o ponto já está vinculado, determinar a etapa inicial
    let etapaInicial = "rack";
    if(ponto.rackId && ponto.patchId){
        etapaInicial = "porta";
    }else if(ponto.rackId){
        etapaInicial = "patch";
    }

    vinculoAtivo = {
        mesaId,
        pontoId,
        etapa: etapaInicial,
        rackId: ponto.rackId || null,
        patchId: ponto.patchId || null
    };

    abrirPainelVinculo();
}

function renderPainelVinculo(){
    if(!vinculoAtivo || !vinculoOverlay) return;

    const etapa = vinculoAtivo.etapa;
    const ponto = getMesaPonto(vinculoAtivo.mesaId, vinculoAtivo.pontoId);

    let html = '<div class="vinculoPainel">';

    // Cabeçalho com breadcrumb e título
    html += '<div class="vinculoCabecalho">';
    html += '<div class="vinculoBreadcrumb">' + construirBreadcrumb() + '</div>';

    if(etapa === "rack") html += '<div class="vinculoTitulo">Selecione um rack</div>';
    else if(etapa === "patch") html += '<div class="vinculoTitulo">Selecione um patch panel</div>';
    else if(etapa === "porta") html += '<div class="vinculoTitulo">Selecione uma porta</div>';

    html += '</div>';

    // Conteúdo
    html += '<div class="vinculoConteudo">';

    // Se o ponto já tem vínculo, mostrar
    if(ponto && ponto.rackId && ponto.patchId && ponto.porta){
        html += '<div class="vinculoVinculoAtual">Vínculo atual: ' + resumirLigacaoPonto(ponto) + '</div>';
    }

    if(etapa === "rack"){
        if(db.racks.length === 0){
            html += '<div class="vinculoVazio">Nenhum rack cadastrado.<br>Crie um rack no menu lateral.</div>';
        }else{
            html += '<div class="vinculoLista">';
            db.racks.forEach(r=>{
                html += '<button class="vinculoOpcao" onclick="selecionarRackVinculo(' + r.id + ')">' + r.nome + '</button>';
            });
            html += '</div>';
        }
    }else if(etapa === "patch"){
        const rack =
        db.racks.find(
            r=>r.id===vinculoAtivo.rackId
        );
        if(!rack || rack.patchPanels.length === 0){
            html += '<div class="vinculoVazio">Este rack não tem patch panels.<br>Crie um patch panel no menu lateral.</div>';
        }else{
            html += '<div class="vinculoLista">';
            rack.patchPanels.forEach(pp=>{
                html += '<button class="vinculoOpcao" onclick="selecionarPatchVinculo(' + pp.id + ')">' + pp.nome + ' (' + pp.portas + ' portas)</button>';
            });
            html += '</div>';
        }
    }else if(etapa === "porta"){
        const rack =
        db.racks.find(
            r=>r.id===vinculoAtivo.rackId
        );
        if(rack){
            const patchPanel =
            rack.patchPanels.find(
                pp=>pp.id===vinculoAtivo.patchId
            );
            if(patchPanel){
                const portasLivres =
                obterPortasLivres(
                    rack.id,
                    patchPanel.id,
                    ponto
                );
                if(portasLivres.length === 0){
                    html += '<div class="vinculoVazio">Todas as portas estão ocupadas.</div>';
                }else{
                    html += '<div class="vinculoOpcoesGrid">';
                    for(let i = 1; i <= patchPanel.portas; i++){
                        const livre = portasLivres.indexOf(i) !== -1;
                        if(livre){
                            html += '<button class="vinculoOpcao" onclick="selecionarPortaVinculo(' + i + ')">' + i + '</button>';
                        }else{
                            html += '<div class="vinculoOpcao vinculoOpcao--disabled">' + i + '</div>';
                        }
                    }
                    html += '</div>';
                }
            }
        }
    }

    html += '</div>';

    // Ações
    html += '<div class="vinculoAcoes">';
    if(ponto && ponto.rackId && ponto.patchId && ponto.porta) {
        html += '<button class="vinculoDesvincular" onclick="desvincularPonto()">Limpar</button>';
    }
    if(etapa !== "rack"){
        html += '<button class="vinculoVoltar" onclick="voltarEtapaVinculo()">Voltar</button>';
    }
    html += '<button class="vinculoCancelar" onclick="cancelarVinculo()">Cancelar</button>';
    html += '</div>';

    html += '</div>';

    vinculoOverlay.innerHTML = html;
}

function desvincularPonto(){
    const ponto = getMesaPonto(vinculoAtivo.mesaId, vinculoAtivo.pontoId);
    if(!ponto) return;
    ponto.rackId = null;
    ponto.patchId = null;
    ponto.porta = null;
    saveData();
    vinculoAtivo = null;
    fecharPainelVinculo();
    renderMesas();
}

function cancelarVinculo(){
    vinculoAtivo = null;
    fecharPainelVinculo();
}

function voltarEtapaVinculo(){
    if(!vinculoAtivo) return;

    if(vinculoAtivo.etapa === "patch"){
        vinculoAtivo.etapa = "rack";
        vinculoAtivo.rackId = null;
    }else if(vinculoAtivo.etapa === "porta"){
        vinculoAtivo.etapa = "patch";
        vinculoAtivo.patchId = null;
    }else{
        vinculoAtivo = null;
        fecharPainelVinculo();
        return;
    }

    renderPainelVinculo();
}

function selecionarRackVinculo(rackId){
    if(!vinculoAtivo) return;

    vinculoAtivo.rackId = rackId;
    vinculoAtivo.patchId = null;
    vinculoAtivo.etapa = "patch";
    renderPainelVinculo();
}

function selecionarPatchVinculo(patchId){
    if(!vinculoAtivo) return;

    vinculoAtivo.patchId = patchId;
    vinculoAtivo.etapa = "porta";
    renderPainelVinculo();
}

function selecionarPortaVinculo(porta){
    if(!vinculoAtivo) return;

    const mesa =
    db.mesas.find(
        m=>m.id===vinculoAtivo.mesaId
    );

    const ponto =
    mesa?.pontos.find(
        p=>p.id===vinculoAtivo.pontoId
    );

    const rack =
    db.racks.find(
        r=>r.id===vinculoAtivo.rackId
    );

    const patchPanel =
    rack?.patchPanels.find(
        pp=>pp.id===vinculoAtivo.patchId
    );

    if(!mesa || !ponto || !rack || !patchPanel) return;

    const portasLivres =
    obterPortasLivres(
        rack.id,
        patchPanel.id,
        ponto
    );

    if(!portasLivres.includes(porta)){
        mostrarAviso(
            "Porta indisponível",
            "Essa porta não está mais livre."
        );
        return;
    }

    ponto.rackId = rack.id;
    ponto.patchId = patchPanel.id;
    ponto.porta = porta;

    saveData();
    vinculoAtivo = null;
    fecharPainelVinculo();
    renderMesas();
}

function obterPortasLivres(
    rackId,
    patchId,
    pontoAtual
){

    const rack =
    db.racks.find(
        r=>r.id===rackId
    );

    const patchPanel =
    rack?.patchPanels.find(
        pp=>pp.id===patchId
    );

    if(!patchPanel) return [];

    const ocupadas = new Set(
        db.mesas.flatMap(mesa=>
            mesa.pontos.filter(p=>
                p !== pontoAtual &&
                p.rackId===rackId &&
                p.patchId===patchId &&
                p.porta
            ).map(p=>p.porta)
        )
    );

    return Array.from(
        {length:patchPanel.portas},
        (_,indice)=>indice+1
    ).filter(
        porta=>!ocupadas.has(porta)
    );
}

async function apagarMesa(mesaId){

    const indice =
    db.mesas.findIndex(
        m=>m.id===mesaId
    );

    if(indice === -1) return;

    const mesa =
    db.mesas[indice];

    const confirmado =
    await solicitarConfirmacao(
        "Apagar mesa",
        `Deseja apagar a mesa ${mesa.nome}?`
    );

    if(!confirmado) return;

    db.mesas.splice(indice, 1);

    if(vinculoAtivo?.mesaId === mesaId){
        vinculoAtivo = null;
    }

    reorganizarGrelha();
    saveData();
    renderMesas();
}
