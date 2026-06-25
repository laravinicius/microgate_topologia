-- Migration 002: Adiciona suporte a andares/setores por empresa
-- Executar no banco: mysql inframap < database/migrations/002_adiciona_andares.sql

CREATE TABLE IF NOT EXISTS `andares` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `empresa_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_andar_empresa_nome` (`empresa_id`, `nome`),
    CONSTRAINT `fk_andares_empresas`
        FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `mesas` ADD COLUMN `andar_id` INT UNSIGNED NULL
    REFERENCES `andares`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `mesas` ADD INDEX `idx_mesas_andar_id` (`andar_id`);

INSERT INTO `andares` (`id`, `empresa_id`, `nome`) VALUES (1, 1, '3 andar')
ON DUPLICATE KEY UPDATE `nome` = '3 andar';

UPDATE `mesas` SET `andar_id` = 1 WHERE `empresa_id` = 1 AND `andar_id` IS NULL;
