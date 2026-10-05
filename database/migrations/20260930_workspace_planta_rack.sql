-- Migração aditiva para instalações existentes do InfraMap.
-- Aplicar uma vez (ou novamente com segurança) antes de publicar o novo app.
-- Rollback operacional: voltar a versão anterior da aplicação e manter estas
-- estruturas aditivas; assim os novos dados permanecem preservados.

USE `inframap`;

ALTER TABLE `racks`
    ADD COLUMN IF NOT EXISTS `altura_u` INT UNSIGNED NOT NULL DEFAULT 42;

ALTER TABLE `patch_panels`
    ADD COLUMN IF NOT EXISTS `posicao_u` INT UNSIGNED DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `altura_u` INT UNSIGNED NOT NULL DEFAULT 1;

SET @rack_id_type = (
    SELECT `COLUMN_TYPE`
    FROM `information_schema`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'racks'
      AND `COLUMN_NAME` = 'id'
    LIMIT 1
);

SET @create_rack_equipamentos = CONCAT(
    'CREATE TABLE IF NOT EXISTS `rack_equipamentos` (',
    '`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,',
    '`rack_id` ', @rack_id_type, ' NOT NULL,',
    '`nome` VARCHAR(120) NOT NULL,',
    '`tipo` VARCHAR(40) NOT NULL DEFAULT ''equipamento'',',
    '`posicao_u` INT UNSIGNED NOT NULL,',
    '`altura_u` INT UNSIGNED NOT NULL DEFAULT 1,',
    '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    'PRIMARY KEY (`id`),',
    'INDEX `idx_rack_equipamentos_rack` (`rack_id`),',
    'CONSTRAINT `fk_rack_equipamentos_rack` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`) ON DELETE CASCADE',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);
PREPARE `create_rack_equipamentos_stmt` FROM @create_rack_equipamentos;
EXECUTE `create_rack_equipamentos_stmt`;
DEALLOCATE PREPARE `create_rack_equipamentos_stmt`;

CREATE TABLE IF NOT EXISTS `floor_plans` (
    `andar_id` INT UNSIGNED NOT NULL,
    `empresa_id` INT UNSIGNED NOT NULL,
    `nome_arquivo` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(40) NOT NULL,
    `arquivo` LONGBLOB NOT NULL,
    `x` INT NOT NULL DEFAULT 0,
    `y` INT NOT NULL DEFAULT 0,
    `largura` INT UNSIGNED NOT NULL DEFAULT 0,
    `altura` INT UNSIGNED NOT NULL DEFAULT 0,
    `opacidade` DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    `bloqueada` TINYINT(1) NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`andar_id`),
    INDEX `idx_floor_plans_empresa` (`empresa_id`),
    CONSTRAINT `fk_floor_plans_andares` FOREIGN KEY (`andar_id`) REFERENCES `andares` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_floor_plans_empresas` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
