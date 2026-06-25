CREATE TABLE IF NOT EXISTS `app_config` (
	`key` VARCHAR(50) NOT NULL,
	`value` TEXT NOT NULL,
	PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Senha padrão (hash bcrypt) — substitua por seed-password.js em produção
-- INSERT INTO app_config (`key`, `value`) VALUES ('admin_password_hash', '$2b$12$...');
-- Ajuste o nome do banco se necessário antes de executar.

CREATE DATABASE IF NOT EXISTS `inframap`
	CHARACTER SET utf8mb4
	COLLATE utf8mb4_unicode_ci;

USE `inframap`;

-- Tabela de usuários (autenticação por login/senha)
CREATE TABLE IF NOT EXISTS `users` (
	`id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
	`username` VARCHAR(100) NOT NULL,
	`password_hash` VARCHAR(255) NOT NULL,
	`is_active` TINYINT(1) NOT NULL DEFAULT 1,
	`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `racks` (
	`id` BIGINT UNSIGNED NOT NULL,
	`nome` VARCHAR(120) NOT NULL,
	`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `patch_panels` (
	`id` BIGINT UNSIGNED NOT NULL,
	`rack_id` BIGINT UNSIGNED NOT NULL,
	`nome` VARCHAR(120) NOT NULL,
	`portas` TINYINT UNSIGNED NOT NULL DEFAULT 24,
	`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `idx_patch_panels_rack_id` (`rack_id`),
	CONSTRAINT `fk_patch_panels_racks`
		FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`)
		ON DELETE CASCADE
		ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mesas` (
	`id` BIGINT UNSIGNED NOT NULL,
	`nome` VARCHAR(120) NOT NULL,
	`x` INT NOT NULL DEFAULT 100,
	`y` INT NOT NULL DEFAULT 100,
	`fixada` TINYINT(1) NOT NULL DEFAULT 0,
	`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mesa_pontos` (
	`id` BIGINT UNSIGNED NOT NULL,
	`mesa_id` BIGINT UNSIGNED NOT NULL,
	`numero` TINYINT UNSIGNED NOT NULL,
	`rack_id` BIGINT UNSIGNED NULL,
	`patch_panel_id` BIGINT UNSIGNED NULL,
	`porta` TINYINT UNSIGNED NULL,
	PRIMARY KEY (`id`),
	UNIQUE KEY `uk_mesa_pontos_mesa_numero` (`mesa_id`, `numero`),
	UNIQUE KEY `uk_mesa_pontos_vinculo` (`rack_id`, `patch_panel_id`, `porta`),
	KEY `idx_mesa_pontos_mesa_id` (`mesa_id`),
	KEY `idx_mesa_pontos_rack_id` (`rack_id`),
	KEY `idx_mesa_pontos_patch_panel_id` (`patch_panel_id`),
	CONSTRAINT `fk_mesa_pontos_mesas`
		FOREIGN KEY (`mesa_id`) REFERENCES `mesas` (`id`)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT `fk_mesa_pontos_racks`
		FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`)
		ON DELETE SET NULL
		ON UPDATE CASCADE,
	CONSTRAINT `fk_mesa_pontos_patch_panels`
		FOREIGN KEY (`patch_panel_id`) REFERENCES `patch_panels` (`id`)
		ON DELETE SET NULL
		ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP USER IF EXISTS 'inframap'@'%';
CREATE USER 'inframap'@'%' IDENTIFIED BY '';

GRANT ALL PRIVILEGES ON `inframap`.* TO 'inframap'@'%';
FLUSH PRIVILEGES;
