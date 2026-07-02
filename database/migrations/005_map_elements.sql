-- Tabela para elementos do mapa livre (mesas, racks, objetos customizados)
CREATE TABLE IF NOT EXISTS map_elements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    empresa_id BIGINT UNSIGNED NOT NULL,
    andar_id BIGINT UNSIGNED DEFAULT NULL,
    tipo ENUM('mesa', 'rack', 'objeto') NOT NULL DEFAULT 'objeto',
    nome VARCHAR(100) NOT NULL DEFAULT '',
    x INT NOT NULL DEFAULT 0,
    y INT NOT NULL DEFAULT 0,
    largura INT NOT NULL DEFAULT 100,
    altura INT NOT NULL DEFAULT 60,
    cor VARCHAR(7) DEFAULT '#374151',
    rotacao INT NOT NULL DEFAULT 0,
    ordem INT NOT NULL DEFAULT 0,
    dados_json JSON DEFAULT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_empresa (empresa_id),
    INDEX idx_andar (andar_id),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (andar_id) REFERENCES andares(id) ON DELETE CASCADE
);
