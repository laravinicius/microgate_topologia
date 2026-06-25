let promptAtivo = null;

function fecharPromptSistema(valor){
    if(!promptAtivo) return;

    const {
        overlay,
        resolver,
        controleAnterior
    } = promptAtivo;

    overlay.remove();
    promptAtivo = null;

    if(controleAnterior?.focus){
        controleAnterior.focus();
    }

    resolver(valor);
}

function criarPromptSistema({
    titulo,
    mensagem,
    tipo = "texto",
    valorInicial = ""
}){
    if(promptAtivo){
        fecharPromptSistema(null);
    }

    const overlay =
    document.createElement("div");

    overlay.className = "promptSistemaOverlay";

    const conteudo =
    document.createElement("div");

    conteudo.className = "promptSistema";
    conteudo.setAttribute("role", "dialog");
    conteudo.setAttribute("aria-modal", "true");

    const form =
    document.createElement("form");

    form.innerHTML = `
        <h3>${titulo}</h3>
        ${mensagem ? `<p>${mensagem}</p>` : ""}
        ${tipo === "texto" ? `<input type="text" autocomplete="off" value="${valorInicial.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}" />` : ""}
        <div class="promptSistemaAcoes">
            ${tipo === "texto" ? '<button type="button" class="promptCancelar">Cancelar</button>' : ""}
            <button type="submit" class="promptConfirmar">${tipo === "texto" ? "Salvar" : "Ok"}</button>
        </div>
    `;

    conteudo.appendChild(form);
    overlay.appendChild(conteudo);
    document.body.appendChild(overlay);

    return {
        overlay,
        form,
        input:form.querySelector("input"),
        cancelar:form.querySelector(".promptCancelar")
    };
}

function solicitarTexto(titulo, mensagem = "", valorInicial = ""){
    return new Promise(resolve=>{
        const controleAnterior =
        document.activeElement;

        const {
            overlay,
            form,
            input,
            cancelar
        } = criarPromptSistema({
            titulo,
            mensagem,
            tipo:"texto",
            valorInicial
        });

        promptAtivo = {
            overlay,
            resolver:resolve,
            controleAnterior
        };

        form.addEventListener("submit", evento=>{
            evento.preventDefault();

            const valor =
            input.value.trim();

            fecharPromptSistema(valor || null);
        });

        cancelar.addEventListener(
            "click",
            ()=>fecharPromptSistema(null)
        );

        overlay.addEventListener("click", evento=>{
            if(evento.target === overlay){
                fecharPromptSistema(null);
            }
        });

        input.focus();
    });
}

function mostrarAviso(titulo, mensagem = ""){
    return new Promise(resolve=>{
        const controleAnterior =
        document.activeElement;

        const {
            overlay,
            form
        } = criarPromptSistema({
            titulo,
            mensagem,
            tipo:"aviso"
        });

        promptAtivo = {
            overlay,
            resolver:resolve,
            controleAnterior
        };

        form.addEventListener("submit", evento=>{
            evento.preventDefault();
            fecharPromptSistema(true);
        });

        overlay.addEventListener("click", evento=>{
            if(evento.target === overlay){
                fecharPromptSistema(true);
            }
        });

        form.querySelector("button").focus();
    });
}

function solicitarConfirmacao(titulo, mensagem = ""){
    return new Promise(resolve=>{
        if(promptAtivo){
            fecharPromptSistema(null);
        }

        const controleAnterior =
        document.activeElement;

        const overlay =
        document.createElement("div");

        overlay.className = "promptSistemaOverlay";

        const conteudo =
        document.createElement("div");

        conteudo.className = "promptSistema";
        conteudo.setAttribute("role", "dialog");
        conteudo.setAttribute("aria-modal", "true");

        const form =
        document.createElement("form");

        form.innerHTML = `
            <h3>${titulo}</h3>
            ${mensagem ? `<p>${mensagem}</p>` : ""}
            <div class="promptSistemaAcoes">
                <button type="button" class="promptCancelar">Cancelar</button>
                <button type="submit" class="promptConfirmar promptPerigo">Apagar</button>
            </div>
        `;

        conteudo.appendChild(form);
        overlay.appendChild(conteudo);
        document.body.appendChild(overlay);

        promptAtivo = {
            overlay,
            resolver:resolve,
            controleAnterior
        };

        form.addEventListener("submit", evento=>{
            evento.preventDefault();
            fecharPromptSistema(true);
        });

        form
        .querySelector(".promptCancelar")
        .addEventListener(
            "click",
            ()=>fecharPromptSistema(false)
        );

        overlay.addEventListener("click", evento=>{
            if(evento.target === overlay){
                fecharPromptSistema(false);
            }
        });

        form.querySelector(".promptCancelar").focus();
    });
}

function solicitarOpcao(titulo, mensagem = "", opcoes = []){
    return new Promise(resolve=>{
        if(promptAtivo){
            fecharPromptSistema(null);
        }

        const controleAnterior =
        document.activeElement;

        const overlay =
        document.createElement("div");

        overlay.className = "promptSistemaOverlay";

        const conteudo =
        document.createElement("div");

        conteudo.className = "promptSistema";
        conteudo.setAttribute("role", "dialog");
        conteudo.setAttribute("aria-modal", "true");

        const form =
        document.createElement("form");

        form.innerHTML = `
            <h3>${titulo}</h3>
            ${mensagem ? `<p>${mensagem}</p>` : ""}
            <div class="promptSistemaOpcoes">
                ${opcoes.map(opcao=>`
                    <button type="button" class="promptOpcao" data-valor="${opcao.valor}">${opcao.label}</button>
                `).join("")}
            </div>
            <div class="promptSistemaAcoes">
                <button type="button" class="promptCancelar">Cancelar</button>
            </div>
        `;

        conteudo.appendChild(form);
        overlay.appendChild(conteudo);
        document.body.appendChild(overlay);

        promptAtivo = {
            overlay,
            resolver:resolve,
            controleAnterior
        };

        const opcoesButtons = form.querySelectorAll(".promptOpcao");

        opcoesButtons.forEach(botao=>{
            botao.addEventListener("click", ()=>{
                const valor = botao.getAttribute("data-valor");
                fecharPromptSistema(valor);
            });
        });

        form
        .querySelector(".promptCancelar")
        .addEventListener(
            "click",
            ()=>fecharPromptSistema(null)
        );

        overlay.addEventListener("click", evento=>{
            if(evento.target === overlay){
                fecharPromptSistema(null);
            }
        });

        if(opcoesButtons.length > 0){
            opcoesButtons[0].focus();
        }else{
            form.querySelector(".promptCancelar").focus();
        }
    });
}

document.addEventListener("keydown", evento=>{
    if(evento.key === "Escape" && promptAtivo){
        fecharPromptSistema(null);
    }
});
