CREATE DATABASE IF NOT EXISTS inframap
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE inframap;

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(80) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `is_admin` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `empresas` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_empresas_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `andares` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_andar_empresa_nome` (`empresa_id`, `nome`),
    CONSTRAINT `fk_andares_empresas`
        FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `racks` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `empresa_id` INT UNSIGNED NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_racks_empresa_nome` (`empresa_id`, `nome`),
    CONSTRAINT `fk_racks_empresas`
        FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `patch_panels` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `rack_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `portas` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_patch_panels_rack_nome` (`rack_id`, `nome`),
    INDEX `idx_patch_panels_rack_id` (`rack_id`),
    CONSTRAINT `fk_patch_panels_racks`
        FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mesas` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `x` INT NOT NULL DEFAULT 100,
    `y` INT NOT NULL DEFAULT 100,
    `fixada` TINYINT(1) NOT NULL DEFAULT 0,
    `empresa_id` INT UNSIGNED NOT NULL DEFAULT 1,
    `andar_id` INT UNSIGNED NULL,
    `font_size` INT UNSIGNED NOT NULL DEFAULT 15,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_mesas_empresa_nome` (`empresa_id`, `nome`),
    INDEX `idx_mesas_empresa_id` (`empresa_id`),
    INDEX `idx_mesas_andar_id` (`andar_id`),
    CONSTRAINT `fk_mesas_empresas`
        FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mesas_andares`
        FOREIGN KEY (`andar_id`) REFERENCES `andares` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mesa_pontos` (
    `id` INT UNSIGNED NOT NULL,
    `mesa_id` INT UNSIGNED NOT NULL,
    `numero` INT UNSIGNED NOT NULL,
    `rack_id` INT UNSIGNED NULL,
    `patch_panel_id` INT UNSIGNED NULL,
    `porta` INT UNSIGNED NULL,
    `atencao` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_mesa_pontos_mesa_id` (`mesa_id`),
    INDEX `idx_mesa_pontos_link` (`rack_id`, `patch_panel_id`),
    CONSTRAINT `fk_mp_mesa`
        FOREIGN KEY (`mesa_id`) REFERENCES `mesas` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_rack`
        FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_mp_patch_panel`
        FOREIGN KEY (`patch_panel_id`) REFERENCES `patch_panels` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `map_elements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `empresa_id` INT UNSIGNED NOT NULL,
    `andar_id` INT UNSIGNED DEFAULT NULL,
    `tipo` ENUM('mesa', 'rack', 'objeto') NOT NULL DEFAULT 'objeto',
    `nome` VARCHAR(100) NOT NULL DEFAULT '',
    `x` INT NOT NULL DEFAULT 0,
    `y` INT NOT NULL DEFAULT 0,
    `largura` INT NOT NULL DEFAULT 100,
    `altura` INT NOT NULL DEFAULT 60,
    `cor` VARCHAR(7) DEFAULT '#374151',
    `rotacao` INT NOT NULL DEFAULT 0,
    `ordem` INT NOT NULL DEFAULT 0,
    `dados_json` JSON DEFAULT NULL,
    `font_size` INT UNSIGNED NOT NULL DEFAULT 12,
    `criado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `atualizado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_empresa` (`empresa_id`),
    INDEX `idx_andar` (`andar_id`),
    CONSTRAINT `fk_map_elements_empresas`
        FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_map_elements_andares`
        FOREIGN KEY (`andar_id`) REFERENCES `andares` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_empresas` (
    `user_id` INT UNSIGNED NOT NULL,
    `empresa_id` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`user_id`, `empresa_id`),
    CONSTRAINT `fk_ue_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ue_empresa`
        FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `empresas` (`id`, `nome`) VALUES (1, 'WAP')
ON DUPLICATE KEY UPDATE `nome` = 'WAP';

INSERT INTO `andares` (`id`, `empresa_id`, `nome`) VALUES (1, 1, '3 andar')
ON DUPLICATE KEY UPDATE `nome` = '3 andar';

INSERT INTO `users` (`id`, `username`, `password_hash`, `is_admin`) VALUES (1, 'admin', '$2b$08$1xi0k./Chpsw7lW.YdZdF.E8E2C.MAQEBGEYIJWG8C1zstZl97QT2', 1)
ON DUPLICATE KEY UPDATE `username` = 'admin';
