-- Adiciona coluna atencao na tabela mesa_pontos
ALTER TABLE mesa_pontos ADD COLUMN atencao TINYINT(1) NOT NULL DEFAULT 0;
