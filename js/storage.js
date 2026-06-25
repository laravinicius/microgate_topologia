const STORAGE = "inframap";
const API_DATA = "/api/data";
const API_SSE = "/api/sse";

let sseSource = null;
let sseRefetchPending = false;

function dadosVazios(){
    return {
        mesas:[],
        racks:[]
    };
}

function normalizarDados(dados){
    return {
        mesas:Array.isArray(dados?.mesas) ? dados.mesas : [],
        racks:Array.isArray(dados?.racks) ? dados.racks : []
    };
}

function temDados(dados){
    return Boolean(
        dados?.mesas?.length ||
        dados?.racks?.length
    );
}

function carregarDadosLocais(){
    try{
        return normalizarDados(
            JSON.parse(
                localStorage.getItem(STORAGE)
            )
        );
    }catch(error){
        console.error("Não foi possível ler dados locais:", error);
        return dadosVazios();
    }
}

function aplicarDados(dados){
    const dadosNormalizados =
    normalizarDados(dados);

    db.mesas.splice(
        0,
        db.mesas.length,
        ...dadosNormalizados.mesas
    );

    db.racks.splice(
        0,
        db.racks.length,
        ...dadosNormalizados.racks
    );
}

function saveData(){
    return fetch(API_DATA, {
        method:"PUT",
        credentials:"same-origin",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify(db)
    }).then(resposta=>{
        if(!resposta.ok){
            throw new Error("Falha ao salvar dados no servidor");
        }

        localStorage.setItem(
            STORAGE,
            JSON.stringify(db)
        );
    }).catch(error=>{
        console.error("Não foi possível salvar no servidor:", error);
    });
}

function fecharSSE(){
    if(sseSource){
        sseSource.close();
        sseSource = null;
    }
}

function conectarSSE(){
    fecharSSE();
    sseSource = new EventSource(API_SSE);

    sseSource.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if(msg.type === 'connected'){
            return;
        }
        if(msg.type === 'update' && !sseRefetchPending){
            sseRefetchPending = true;
            carregarDadosServidor()
                .then(dados => {
                    aplicarDados(dados);
                    localStorage.setItem(STORAGE, JSON.stringify(db));
                    reorganizarGrelha();
                    renderMesas();
                    renderRacks();
                })
                .catch(() => {})
                .finally(() => {
                    sseRefetchPending = false;
                });
        }
    };

    sseSource.onerror = () => {
        // EventSource reconecta automaticamente
    };
}

async function carregarDadosServidor(){
    const resposta =
    await fetch(API_DATA, { credentials: "same-origin" });

    if(!resposta.ok){
        throw new Error("Falha ao carregar dados do servidor");
    }

    return normalizarDados(
        await resposta.json()
    );
}

async function sincronizarBanco(){
    try{
        const dados =
        await carregarDadosServidor();

        const dadosLocais =
        carregarDadosLocais();

        if(!temDados(dados) && temDados(dadosLocais)){
            aplicarDados(dadosLocais);
            await saveData();
        }else{
            aplicarDados(dados);

            localStorage.setItem(
                STORAGE,
                JSON.stringify(db)
            );
        }
    }catch(error){
        console.error("Usando dados locais:", error);
        aplicarDados(
            carregarDadosLocais()
        );
    }

    reorganizarGrelha();
    renderMesas();
    renderRacks();
    conectarSSE();
}

async function sincronizarManual(){
    const btn = document.getElementById('syncBtn');
    if(btn) btn.disabled = true;

    try{
        const dados = await carregarDadosServidor();
        aplicarDados(dados);
        localStorage.setItem(STORAGE, JSON.stringify(db));
        reorganizarGrelha();
        renderMesas();
        renderRacks();
    }catch(error){
        console.error("Falha ao sincronizar:", error);
    }finally{
        if(btn) btn.disabled = false;
    }
}
