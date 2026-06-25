-- Migration 001: Adiciona suporte multi-tenant (empresas)
-- Executar no banco: mysql inframap < database/migrations/001_adiciona_empresas.sql

-- Tabela de empresas
CREATE TABLE IF NOT EXISTS `empresas` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `nome` VARCHAR(120) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_empresas_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Empresa padrão WAP
INSERT INTO `empresas` (`id`, `nome`) VALUES (1, 'WAP')
ON DUPLICATE KEY UPDATE `nome` = 'WAP';

-- Adicionar empresa_id nas tabelas existentes
ALTER TABLE `racks` ADD COLUMN `empresa_id` INT UNSIGNED NOT NULL DEFAULT 1
    REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mesas` ADD COLUMN `empresa_id` INT UNSIGNED NOT NULL DEFAULT 1
    REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Atualizar registros existentes para empresa WAP (id=1)
UPDATE `racks` SET `empresa_id` = 1 WHERE `empresa_id` != 1;
UPDATE `mesas` SET `empresa_id` = 1 WHERE `empresa_id` != 1;
